package com.aifamily.deviceagent.work

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.aifamily.deviceagent.R
import com.aifamily.deviceagent.model.CommandType
import com.aifamily.deviceagent.model.DeviceCommand
import com.aifamily.deviceagent.network.DeviceApiClient
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

sealed class ExecutionResult {
    object Executed : ExecutionResult()
    data class Failed(val reason: String) : ExecutionResult()
}

/**
 * اجرای واقعی دستورات دریافتی — طبق محدودیت صادقانه‌ای که در فصل ۱۱ Blueprint نهایی هم تکرار شده:
 * بسیاری از دستورات (قفل/باز کردن دستگاه، مسدودسازی اپ، محدودیت زمان صفحه، حالت خواب، پاک‌سازی
 * داده) فقط در Device Owner Mode واقعی (DevicePolicyManager کامل) قابل اجرا هستند — نه با یک اپ
 * عادی نصب‌شده در Standard Mode. این نسخه MVP فقط دستوراتی را واقعاً اجرا می‌کند که بدون
 * Device Owner هم ممکن‌اند؛ بقیه صادقانه FAILED گزارش می‌شوند، نه ادعای اجرای ساختگی.
 * پیاده‌سازی Device Owner Mode (نصب از طریق QR Provisioning + DevicePolicyManager) آیتم باز بعدی است.
 */
class CommandExecutor(private val context: Context, private val api: DeviceApiClient) {

    fun execute(command: DeviceCommand): ExecutionResult = when (command.type) {
        CommandType.SYNC_POLICY -> executeSyncPolicy()
        CommandType.FORCE_LOCATION_UPDATE -> executeForceLocationUpdate()
        CommandType.SEND_PARENT_MESSAGE -> executeSendParentMessage(command)
        CommandType.REMOTE_ALARM -> executeRemoteAlarm()
        CommandType.LOCK_DEVICE,
        CommandType.UNLOCK_DEVICE,
        CommandType.SET_SCREEN_TIME_LIMIT,
        CommandType.BLOCK_APP,
        CommandType.UNBLOCK_APP,
        CommandType.SLEEP_MODE_ENABLE,
        CommandType.SLEEP_MODE_DISABLE,
        CommandType.WIPE_DATA,
        -> ExecutionResult.Failed(
            "دستور ${command.type.wireValue} نیازمند Device Owner Mode است که هنوز در این " +
                "Device Agent پیاده‌سازی نشده (آیتم باز — نیازمند QR Provisioning + DevicePolicyManager)",
        )
    }

    private fun executeSyncPolicy(): ExecutionResult = try {
        // صرفاً دریافت آخرین Policy کافی است؛ اعمال واقعی محدودیت‌های آن (مسدودسازی اپ و...) خودش
        // نیازمند Device Owner Mode است و در executeسازی دستورات دیگر بالا مستند شده.
        api.fetchCurrentPolicy()
        ExecutionResult.Executed
    } catch (e: Exception) {
        ExecutionResult.Failed("دریافت Policy ناموفق بود: ${e.message}")
    }

    private fun executeForceLocationUpdate(): ExecutionResult {
        val hasFine = ActivityCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ActivityCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasFine && !hasCoarse) {
            return ExecutionResult.Failed("مجوز موقعیت مکانی اعطا نشده است")
        }

        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val providers = locationManager.getProviders(true)
        val location = providers
            .mapNotNull {
                @Suppress("MissingPermission")
                locationManager.getLastKnownLocation(it)
            }
            .maxByOrNull { it.time }
            ?: return ExecutionResult.Failed("هیچ موقعیت مکانی شناخته‌شده‌ای در دسترس نیست")

        return try {
            val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            api.reportLocation(
                lat = location.latitude,
                lng = location.longitude,
                accuracyMeters = if (location.hasAccuracy()) location.accuracy else null,
                capturedAtIso8601 = isoFormat.format(Date(location.time)),
            )
            ExecutionResult.Executed
        } catch (e: Exception) {
            // رایج‌ترین حالت: 403 چون Consent والد هنوز فعال نیست (Consent Gate — TC-LOC-019)
            ExecutionResult.Failed("ارسال موقعیت مکانی ناموفق بود (احتمالاً Consent فعال نیست): ${e.message}")
        }
    }

    private fun executeSendParentMessage(command: DeviceCommand): ExecutionResult {
        val message = command.payload["message"] as? String ?: "پیام جدید از والد"
        showNotification("پیام از والد", message)
        return ExecutionResult.Executed
    }

    private fun executeRemoteAlarm(): ExecutionResult {
        val vibrator: Vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            manager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

        if (vibrator.hasVibrator()) {
            val pattern = longArrayOf(0, 800, 400, 800, 400, 800)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(pattern, -1)
            }
        }
        showNotification("هشدار از والد", "والد شما یک هشدار از راه دور فعال کرده است")
        return ExecutionResult.Executed
    }

    private fun showNotification(title: String, body: String) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "پیام‌های والد",
                NotificationManager.IMPORTANCE_HIGH,
            )
            manager.createNotificationChannel(channel)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ActivityCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return // بدون مجوز POST_NOTIFICATIONS (اندروید ۱۳+)، نوتیفیکیشن نمایش داده نمی‌شود
        }

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        manager.notify(System.currentTimeMillis().toInt(), notification)
    }

    companion object {
        private const val CHANNEL_ID = "device_agent_parent_messages"
    }
}
