package com.aifamily.deviceagent

import android.content.Intent
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.aifamily.deviceagent.databinding.ActivityEnrollmentBinding
import com.aifamily.deviceagent.security.SecureStore
import com.aifamily.deviceagent.work.CommandPollWorker

/**
 * صفحه Enrollment — آیتم باز پیشین حل شد: مسیر انتقال امن deviceToken از اپ والد به این دستگاه
 * اکنون هم با اسکن QR Code (دکمه «اسکن کد QR»، [QrScanActivity] با CameraX + ML Kit Barcode
 * Scanning) و هم با ورودی دستی (Base URL + Device Token) پشتیبانی می‌شود — اسکن فقط دو فیلد را
 * از قبل پر می‌کند، معماری Enrollment همان است.
 */
class EnrollmentActivity : AppCompatActivity() {

    private lateinit var binding: ActivityEnrollmentBinding
    private lateinit var secureStore: SecureStore

    private val scanQrLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == RESULT_OK) {
                val apiBaseUrl = result.data?.getStringExtra(QrScanActivity.RESULT_API_BASE_URL)
                val deviceToken = result.data?.getStringExtra(QrScanActivity.RESULT_DEVICE_TOKEN)
                if (!apiBaseUrl.isNullOrEmpty() && !deviceToken.isNullOrEmpty()) {
                    binding.apiBaseUrlInput.setText(apiBaseUrl)
                    binding.deviceTokenInput.setText(deviceToken)
                }
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityEnrollmentBinding.inflate(layoutInflater)
        setContentView(binding.root)
        secureStore = SecureStore(this)

        secureStore.apiBaseUrl?.let { binding.apiBaseUrlInput.setText(it) }
            ?: binding.apiBaseUrlInput.setText(BuildConfig.DEFAULT_API_BASE_URL)

        binding.enrollButton.setOnClickListener { onEnrollClicked() }
        binding.scanQrButton.setOnClickListener {
            scanQrLauncher.launch(Intent(this, QrScanActivity::class.java))
        }

        if (secureStore.isEnrolled) {
            binding.statusText.text = getString(R.string.already_enrolled)
        }
    }

    private fun onEnrollClicked() {
        val baseUrl = binding.apiBaseUrlInput.text?.toString()?.trim().orEmpty()
        val token = binding.deviceTokenInput.text?.toString()?.trim().orEmpty()

        if (baseUrl.isEmpty() || token.isEmpty()) {
            binding.statusText.text = getString(R.string.enrollment_missing_fields)
            return
        }

        secureStore.apiBaseUrl = baseUrl
        secureStore.deviceToken = token
        CommandPollWorker.schedule(applicationContext)

        binding.statusText.text = getString(R.string.enrollment_success)
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
