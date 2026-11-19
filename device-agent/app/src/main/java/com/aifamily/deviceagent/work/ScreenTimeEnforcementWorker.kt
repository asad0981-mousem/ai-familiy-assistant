package com.aifamily.deviceagent.work

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build
import android.os.Process
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.aifamily.deviceagent.admin.AppSuspension
import com.aifamily.deviceagent.admin.DeviceAgentAdminReceiver
import com.aifamily.deviceagent.admin.DeviceOwnerStatus
import com.aifamily.deviceagent.security.SecureStore
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

/**
 * اجرای واقعی محدودیت زمان صفحه (SET_SCREEN_TIME_LIMIT) — اندروید هیچ API مستقیمی برای
 * "محدودیت زمان روزانه" ندارد (برخلاف lockNow/wipeData)؛ این Worker خودش آن را با
 * UsageStatsManager (جمع زمان Foreground امروز) + AppSuspension (تعلیق همه اپ‌ها وقتی از حد
 * گذشت) می‌سازد — دقیقاً همان رویکردی که اکثر اپ‌های والدینی واقعی استفاده می‌کنند، چون پلتفرم
 * خودش یک "Screen Time Limit" آماده نمی‌دهد.
 *
 * محدودیت شناخته‌شده صادقانه: دسترسی «Usage Access» (PACKAGE_USAGE_STATS) یک مجوز AppOps خاص است
 * که با دیالوگ معمولی RequestPermission قابل‌درخواست نیست — کاربر باید دستی از
 * Settings.ACTION_USAGE_ACCESS_SETTINGS آن را فعال کند (دکمه مربوطه در MainActivity). تا وقتی
 * فعال نشده، این Worker بدون خطا کاری انجام نمی‌دهد (نه ادعای اجرای محدودیت).
 */
class ScreenTimeEnforcementWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val secureStore = SecureStore(applicationContext)
        val limitMinutes = secureStore.screenTimeLimitMinutes ?: return Result.success() // محدودیتی تنظیم نشده

        if (!DeviceOwnerStatus.isDeviceOwner(applicationContext)) {
            return Result.success() // بدون Device Owner، نه خواندن Usage Stats معنا دارد نه Suspend کردن
        }
        if (!hasUsageStatsPermission()) {
            return Result.success() // مجوز Usage Access هنوز دستی اعطا نشده — آیتم باز شناخته‌شده
        }

        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
            timeZone = TimeZone.getDefault()
        }
        val today = dateFormat.format(java.util.Date())

        // شروع روز جاری (نه ۲۴ ساعت گذشته) — "زمان صفحه امروز"، نه یک پنجره غلتان.
        val calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val startOfDay = calendar.timeInMillis
        val now = System.currentTimeMillis()

        val usageStatsManager =
            applicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val usageStats = usageStatsManager.queryAndAggregateUsageStats(startOfDay, now)
        val totalForegroundMs = usageStats.values.sumOf { it.totalTimeInForeground }
        val totalForegroundMinutes = totalForegroundMs / 60_000

        val adminComponent = DeviceAgentAdminReceiver.componentName(applicationContext)
        val overLimit = totalForegroundMinutes >= limitMinutes

        if (overLimit && secureStore.screenTimeLimitAppliedOnDate != today) {
            AppSuspension.setAllLaunchableAppsSuspended(applicationContext, adminComponent, true)
            secureStore.screenTimeLimitAppliedOnDate = today
        } else if (!overLimit && secureStore.screenTimeLimitAppliedOnDate == today) {
            // محدودیت همان روز قبلاً لغو/افزایش داده شده (مثلاً والد مجدداً Policy را تنظیم کرد) —
            // آزادسازی دوباره.
            AppSuspension.setAllLaunchableAppsSuspended(applicationContext, adminComponent, false)
            secureStore.screenTimeLimitAppliedOnDate = null
        }

        return Result.success()
    }

    private fun hasUsageStatsPermission(): Boolean {
        val appOps = applicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                applicationContext.packageName,
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                applicationContext.packageName,
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    companion object {
        private const val UNIQUE_WORK_NAME = "screen-time-enforcement-worker"

        /** مثل CommandPollWorker، حداقل بازه واقعی PeriodicWorkRequest در اندروید ۱۵ دقیقه است. */
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<ScreenTimeEnforcementWorker>(
                15,
                java.util.concurrent.TimeUnit.MINUTES,
            ).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_WORK_NAME)
        }
    }
}
