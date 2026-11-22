package com.aifamily.deviceagent.push

import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.aifamily.deviceagent.security.SecureStore
import com.aifamily.deviceagent.network.DeviceApiClient
import com.aifamily.deviceagent.work.CommandPollWorker
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * دریافت واقعی FCM Push — مکمل CommandPollWorker (Outbox Pull Pattern)، نه جایگزین آن. هر پیام
 * دریافتی فقط «داده‌ای» (Data-only، بدون Notification قابل‌رویت برای کاربر) است و تنها اثرش این
 * است که به‌جای صبر تا Poll دوره‌ای بعدی (حداکثر ۱۵ دقیقه)، یک Poll فوری را زمان‌بندی می‌کند — خود
 * محتوای پیام هرگز مستقیماً به‌عنوان دستور اجرا نمی‌شود (اعتماد فقط از مسیر امضاشده/Pull می‌آید).
 *
 * محدودیت صادقانه (جزئیات کامل در README این پوشه): این کلاس و اتصال واقعی‌اش به Firebase فقط وقتی
 * واقعاً اثر دارد که app/google-services.json با پروژه واقعی Firebase جایگزین شده باشد — با
 * Placeholder فعلی، این سرویس هرگز توکن واقعی دریافت نمی‌کند و onMessageReceived هرگز صدا زده
 * نمی‌شود (نه چون کد اشتباه است، بلکه چون به یک پروژه واقعی وصل نیست).
 */
class AiFamilyMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        reportTokenIfPossible(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        // Poll فوری یک‌باره (نه دوره‌ای) — جدا از CommandPollWorker.schedule() دوره‌ای در
        // MainActivity، با همان کلاس Worker، با سیاست REPLACE تا چند Push پشت‌سرهم Poll تکراری
        // صف نکنند.
        val request = OneTimeWorkRequestBuilder<CommandPollWorker>().build()
        WorkManager.getInstance(applicationContext).enqueueUniqueWork(
            IMMEDIATE_POLL_WORK_NAME,
            ExistingWorkPolicy.REPLACE,
            request,
        )
    }

    private fun reportTokenIfPossible(token: String) {
        val secureStore = SecureStore(applicationContext)
        val deviceToken = secureStore.deviceToken
        val baseUrl = secureStore.apiBaseUrl

        if (deviceToken.isNullOrBlank() || baseUrl.isNullOrBlank()) {
            return // هنوز Enroll نشده — MainActivity بعد از Enrollment دوباره تلاش می‌کند
        }
        if (secureStore.lastReportedFcmToken == token) {
            return // قبلاً همین توکن گزارش شده
        }

        CoroutineScope(Dispatchers.IO).launch {
            runCatching { DeviceApiClient(baseUrl, deviceToken).updateFcmToken(token) }
                .onSuccess { secureStore.lastReportedFcmToken = token }
            // شکست (مثلاً قطعی موقت شبکه) عمداً بی‌صدا نادیده گرفته می‌شود — تلاش بعدی در Poll بعدی
            // MainActivity.onResume یا دریافت onNewToken بعدی انجام می‌شود؛ گزارش توکن فقط بهینه‌سازی
            // تاخیر است، نه مسیر حیاتی.
        }
    }

    companion object {
        private const val IMMEDIATE_POLL_WORK_NAME = "command-poll-worker-immediate"
    }
}
