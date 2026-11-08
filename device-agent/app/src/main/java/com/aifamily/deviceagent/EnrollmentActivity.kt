package com.aifamily.deviceagent

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.aifamily.deviceagent.databinding.ActivityEnrollmentBinding
import com.aifamily.deviceagent.security.SecureStore
import com.aifamily.deviceagent.work.CommandPollWorker

/**
 * صفحه Enrollment — آیتم باز شناخته‌شده: در کدبیس فعلی بک‌اند، deviceToken مستقیماً در پاسخ
 * POST /devices/enroll (که توسط اپ والد صدا زده می‌شود) برمی‌گردد؛ هنوز مسیر انتقال امن آن توکن
 * از اپ والد به همین دستگاه (معمولاً از طریق اسکن QR Code یا لینک Deep Link) پیاده‌سازی نشده.
 * این صفحه فعلاً ورودی دستی (Base URL + Device Token) را می‌پذیرد تا کل مسیر Polling/اجرای دستور
 * به‌طور واقعی قابل‌آزمایش باشد؛ جایگزینی ورودی دستی با اسکن QR یک تغییر مجزا و کوچک در همین
 * Activity خواهد بود (افزودن ML Kit Barcode Scanning)، نه یک معماری جدید.
 */
class EnrollmentActivity : AppCompatActivity() {

    private lateinit var binding: ActivityEnrollmentBinding
    private lateinit var secureStore: SecureStore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityEnrollmentBinding.inflate(layoutInflater)
        setContentView(binding.root)
        secureStore = SecureStore(this)

        secureStore.apiBaseUrl?.let { binding.apiBaseUrlInput.setText(it) }
            ?: binding.apiBaseUrlInput.setText(BuildConfig.DEFAULT_API_BASE_URL)

        binding.enrollButton.setOnClickListener { onEnrollClicked() }

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
