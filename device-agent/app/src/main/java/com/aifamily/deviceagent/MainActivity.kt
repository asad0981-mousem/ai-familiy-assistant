package com.aifamily.deviceagent

import android.Manifest
import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Process
import android.provider.Settings
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.aifamily.deviceagent.admin.DeviceAgentAdminReceiver
import com.aifamily.deviceagent.admin.DeviceOwnerStatus
import com.aifamily.deviceagent.databinding.ActivityMainBinding
import com.aifamily.deviceagent.network.DeviceApiClient
import com.aifamily.deviceagent.security.SecureStore
import com.aifamily.deviceagent.work.CommandPollWorker
import com.aifamily.deviceagent.work.ScreenTimeEnforcementWorker
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * صفحه وضعیت اصلی — بعد از Enrollment نمایش داده می‌شود. وضعیت Polling دوره‌ای را نشان می‌دهد،
 * مجوزهای لازم (موقعیت مکانی، نوتیفیکیشن) را درخواست می‌کند، و وضعیت Device Admin/Device Owner
 * (لازم برای دستورات واقعی قفل/پاک‌سازی/مسدودسازی اپ/محدودیت زمان صفحه در CommandExecutor) و
 * دسترسی Usage Access (لازم برای ScreenTimeEnforcementWorker) را نشان می‌دهد.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var secureStore: SecureStore

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { /* نتیجه مجوزها صرفاً در زمان اجرای دستور دوباره بررسی می‌شود */ }

    private val activateDeviceAdminLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            refreshDeviceAdminStatus()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        secureStore = SecureStore(this)

        if (!secureStore.isEnrolled) {
            startActivity(Intent(this, EnrollmentActivity::class.java))
            finish()
            return
        }

        binding.statusText.text = getString(R.string.agent_running, secureStore.apiBaseUrl)
        binding.unenrollButton.setOnClickListener { onUnenrollClicked() }
        binding.activateDeviceAdminButton.setOnClickListener { onActivateDeviceAdminClicked() }
        binding.usageAccessButton.setOnClickListener { onUsageAccessClicked() }

        requestRuntimePermissions()
        CommandPollWorker.schedule(applicationContext)
        ScreenTimeEnforcementWorker.schedule(applicationContext)
        reportCurrentFcmTokenIfNeeded()
    }

    /**
     * علاوه بر AiFamilyMessagingService.onNewToken (که فقط وقتی توکن *تغییر* کند صدا زده می‌شود)،
     * اینجا هم توکن فعلی را می‌خوانیم — برای حالتی که توکن قبل از Enrollment یا قبل از نصب مجدد
     * اپ از قبل وجود داشته و onNewToken دیگر صدا زده نمی‌شود. با google-services.json واقعی کار
     * می‌کند؛ با Placeholder فعلی این فراخوانی شکست می‌خورد و بی‌صدا نادیده گرفته می‌شود.
     */
    private fun reportCurrentFcmTokenIfNeeded() {
        val deviceToken = secureStore.deviceToken ?: return
        val baseUrl = secureStore.apiBaseUrl ?: return

        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) return@addOnCompleteListener
            val fcmToken = task.result ?: return@addOnCompleteListener
            if (secureStore.lastReportedFcmToken == fcmToken) return@addOnCompleteListener

            CoroutineScope(Dispatchers.IO).launch {
                runCatching { DeviceApiClient(baseUrl, deviceToken).updateFcmToken(fcmToken) }
                    .onSuccess { secureStore.lastReportedFcmToken = fcmToken }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (secureStore.isEnrolled) {
            refreshDeviceAdminStatus()
            refreshDeviceOwnerStatus()
            refreshUsageAccessStatus()
        }
    }

    private fun refreshDeviceOwnerStatus() {
        val active = DeviceOwnerStatus.isDeviceOwner(this)
        binding.deviceOwnerStatusText.text = getString(
            if (active) R.string.device_owner_active else R.string.device_owner_inactive,
        )
    }

    private fun hasUsageStatsPermission(): Boolean {
        val appOps = getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), packageName)
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), packageName)
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun refreshUsageAccessStatus() {
        val granted = hasUsageStatsPermission()
        binding.usageAccessButton.isEnabled = !granted
        binding.deviceOwnerStatusText.append(
            "\n" + getString(if (granted) R.string.usage_access_granted else R.string.usage_access_not_granted),
        )
    }

    private fun onUsageAccessClicked() {
        // PACKAGE_USAGE_STATS یک مجوز AppOps خاص است — هیچ دیالوگ RequestPermission استانداردی
        // ندارد؛ کاربر باید دستی از صفحه تنظیمات اندروید آن را برای این اپ فعال کند.
        startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
    }

    private fun isDeviceAdminActive(): Boolean {
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        return dpm.isAdminActive(DeviceAgentAdminReceiver.componentName(this))
    }

    private fun refreshDeviceAdminStatus() {
        val active = isDeviceAdminActive()
        binding.deviceAdminStatusText.text = getString(
            if (active) R.string.device_admin_active else R.string.device_admin_inactive,
        )
        binding.activateDeviceAdminButton.isEnabled = !active
    }

    private fun onActivateDeviceAdminClicked() {
        val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
            putExtra(
                DevicePolicyManager.EXTRA_DEVICE_ADMIN,
                DeviceAgentAdminReceiver.componentName(this@MainActivity),
            )
            putExtra(
                DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                getString(R.string.device_admin_explanation),
            )
        }
        activateDeviceAdminLauncher.launch(intent)
    }

    private fun requestRuntimePermissions() {
        val needed = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            needed += Manifest.permission.ACCESS_FINE_LOCATION
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            needed += Manifest.permission.POST_NOTIFICATIONS
        }
        if (needed.isNotEmpty()) {
            permissionLauncher.launch(needed.toTypedArray())
        }
    }

    private fun onUnenrollClicked() {
        CommandPollWorker.cancel(applicationContext)
        secureStore.clear()
        startActivity(Intent(this, EnrollmentActivity::class.java))
        finish()
    }
}
