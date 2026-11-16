package com.aifamily.deviceagent

import android.Manifest
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.aifamily.deviceagent.admin.DeviceAgentAdminReceiver
import com.aifamily.deviceagent.databinding.ActivityMainBinding
import com.aifamily.deviceagent.security.SecureStore
import com.aifamily.deviceagent.work.CommandPollWorker

/**
 * صفحه وضعیت اصلی — بعد از Enrollment نمایش داده می‌شود. وضعیت Polling دوره‌ای را نشان می‌دهد،
 * مجوزهای لازم (موقعیت مکانی، نوتیفیکیشن) را درخواست می‌کند، و وضعیت Device Admin (لازم برای
 * دستورات واقعی قفل/پاک‌سازی از راه دور در CommandExecutor) را نشان می‌دهد.
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

        requestRuntimePermissions()
        CommandPollWorker.schedule(applicationContext)
    }

    override fun onResume() {
        super.onResume()
        if (secureStore.isEnrolled) {
            refreshDeviceAdminStatus()
        }
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
