package com.aifamily.deviceagent

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.aifamily.deviceagent.databinding.ActivityMainBinding
import com.aifamily.deviceagent.security.SecureStore
import com.aifamily.deviceagent.work.CommandPollWorker

/**
 * صفحه وضعیت اصلی — بعد از Enrollment نمایش داده می‌شود. وضعیت Polling دوره‌ای را نشان می‌دهد
 * و مجوزهای لازم (موقعیت مکانی، نوتیفیکیشن) را درخواست می‌کند.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var secureStore: SecureStore

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { /* نتیجه مجوزها صرفاً در زمان اجرای دستور دوباره بررسی می‌شود */ }

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

        requestRuntimePermissions()
        CommandPollWorker.schedule(applicationContext)
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
