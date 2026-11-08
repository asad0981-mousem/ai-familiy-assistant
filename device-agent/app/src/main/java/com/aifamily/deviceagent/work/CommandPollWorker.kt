package com.aifamily.deviceagent.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.aifamily.deviceagent.BuildConfig
import com.aifamily.deviceagent.model.CommandStatus
import com.aifamily.deviceagent.model.DeviceCommand
import com.aifamily.deviceagent.network.DeviceApiClient
import com.aifamily.deviceagent.security.CommandSigner
import com.aifamily.deviceagent.security.SecureStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/**
 * Worker دوره‌ای که Outbox Pull Pattern (فصل ۱۶) را پیاده‌سازی می‌کند: هر بار که اجرا می‌شود،
 * دستورات در انتظار را از سرور می‌کشد (Pull، نه Push — چون دستگاه ممکن است پشت NAT/بدون IP ثابت
 * باشد)، امضای هرکدام را محلی تایید می‌کند، اجرا می‌کند و وضعیت را Ack می‌کند.
 *
 * محدودیت شناخته‌شده: حداقل بازه واقعی PeriodicWorkRequest در اندروید ۱۵ دقیقه است (محدودیت خود
 * WorkManager/سیستم‌عامل برای صرفه‌جویی باتری) — یعنی تاخیر واقعی ابلاغ دستور تا ۱۵ دقیقه ممکن
 * است طول بکشد. برای ابلاغ فوری‌تر (مثل SYNC_POLICY بعد از تغییر توسط والد)، مسیر تکمیلی Push
 * (FCM) باید در آینده اضافه شود — این آیتم باز است و اینجا ادعای ابلاغ Real-Time نمی‌شود.
 */
class CommandPollWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val secureStore = SecureStore(applicationContext)
        val token = secureStore.deviceToken
        val baseUrl = secureStore.apiBaseUrl

        if (token.isNullOrBlank() || baseUrl.isNullOrBlank()) {
            return@withContext Result.failure() // هنوز Enroll نشده — کاری برای انجام نیست
        }

        val api = DeviceApiClient(baseUrl, token)
        val executor = CommandExecutor(applicationContext, api)

        return@withContext try {
            val commands = api.fetchPendingCommands()
            for (command in commands) {
                processCommand(command, api, executor)
            }
            Result.success()
        } catch (e: Exception) {
            // خطای شبکه موقت — WorkManager طبق Backoff Policy دوباره تلاش می‌کند، نه شکست قطعی.
            Result.retry()
        }
    }

    private fun processCommand(command: DeviceCommand, api: DeviceApiClient, executor: CommandExecutor) {
        val signatureValid = CommandSigner.verify(
            BuildConfig.COMMAND_SIGNING_SECRET,
            command.signingPayload(),
            command.signature,
        )

        if (!signatureValid) {
            // دستوری که امضایش تایید نمی‌شود هرگز اجرا نمی‌شود — فقط FAILED گزارش می‌شود تا در
            // سرور/لاگ قابل بررسی باشد (می‌تواند نشانه دستکاری یا ناسازگاری نسخه کلید باشد).
            runCatching {
                api.ackCommand(command.id, CommandStatus.FAILED.wireValue, "تایید امضای دستور ناموفق بود")
            }
            return
        }

        runCatching { api.ackCommand(command.id, CommandStatus.RECEIVED.wireValue) }
        runCatching { api.ackCommand(command.id, CommandStatus.EXECUTING.wireValue) }

        val result = runCatching { executor.execute(command) }
            .getOrElse { ExecutionResult.Failed("خطای غیرمنتظره در اجرا: ${it.message}") }

        when (result) {
            is ExecutionResult.Executed ->
                runCatching { api.ackCommand(command.id, CommandStatus.EXECUTED.wireValue) }
            is ExecutionResult.Failed ->
                runCatching { api.ackCommand(command.id, CommandStatus.FAILED.wireValue, result.reason) }
        }
    }

    companion object {
        private const val UNIQUE_WORK_NAME = "command-poll-worker"

        /** حداقل بازه مجاز توسط WorkManager برای PeriodicWorkRequest — ۱۵ دقیقه. */
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<CommandPollWorker>(15, TimeUnit.MINUTES).build()
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
