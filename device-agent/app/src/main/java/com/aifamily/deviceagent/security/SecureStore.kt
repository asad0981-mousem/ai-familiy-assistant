package com.aifamily.deviceagent.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * ذخیره‌سازی امن deviceToken/apiBaseUrl روی دستگاه — با EncryptedSharedPreferences
 * (پشتیبان Android Keystore)، نه SharedPreferences ساده، چون deviceToken یک Credential
 * بلندمدت (۳۶۵ روزه، طبق DevicesService.enroll سمت سرور) است.
 */
class SecureStore(context: Context) {

    private val prefs: SharedPreferences = run {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            context,
            "device_agent_secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    var deviceToken: String?
        get() = prefs.getString(KEY_DEVICE_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_DEVICE_TOKEN, value).apply()

    var apiBaseUrl: String?
        get() = prefs.getString(KEY_API_BASE_URL, null)
        set(value) = prefs.edit().putString(KEY_API_BASE_URL, value).apply()

    val isEnrolled: Boolean
        get() = !deviceToken.isNullOrBlank() && !apiBaseUrl.isNullOrBlank()

    /**
     * آخرین managementMode‌ای که با موفقیت به بک‌اند گزارش شده (نه وضعیت واقعی فعلی دستگاه) —
     * فقط برای جلوگیری از گزارش تکراری هر ۱۵ دقیقه وقتی چیزی تغییر نکرده؛ CommandPollWorker هر
     * بار وضعیت واقعی را از DevicePolicyManager می‌خواند و فقط روی تغییر، API را صدا می‌زند.
     */
    var lastReportedManagementMode: String?
        get() = prefs.getString(KEY_LAST_REPORTED_MANAGEMENT_MODE, null)
        set(value) = prefs.edit().putString(KEY_LAST_REPORTED_MANAGEMENT_MODE, value).apply()

    /**
     * آخرین توکن FCM‌ای که با موفقیت به بک‌اند گزارش شده — برای جلوگیری از گزارش تکراری همان توکن.
     * AiFamilyMessagingService.onNewToken فقط وقتی فرق دارد (یا قبلاً هرگز گزارش نشده) API را
     * صدا می‌زند.
     */
    var lastReportedFcmToken: String?
        get() = prefs.getString(KEY_LAST_REPORTED_FCM_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_LAST_REPORTED_FCM_TOKEN, value).apply()

    /**
     * محدودیت روزانه زمان صفحه (دقیقه) — توسط SET_SCREEN_TIME_LIMIT تنظیم و توسط
     * ScreenTimeEnforcementWorker خوانده می‌شود. null یعنی هیچ محدودیتی تنظیم نشده.
     */
    var screenTimeLimitMinutes: Int?
        get() = prefs.getInt(KEY_SCREEN_TIME_LIMIT_MINUTES, -1).takeIf { it >= 0 }
        set(value) = prefs.edit().apply {
            if (value == null) remove(KEY_SCREEN_TIME_LIMIT_MINUTES) else putInt(KEY_SCREEN_TIME_LIMIT_MINUTES, value)
        }.apply()

    /** تاریخ (yyyy-MM-dd) آخرین باری که محدودیت زمان صفحه واقعاً اعمال (Suspend) شد — برای Reset روزانه. */
    var screenTimeLimitAppliedOnDate: String?
        get() = prefs.getString(KEY_SCREEN_TIME_LIMIT_APPLIED_DATE, null)
        set(value) = prefs.edit().putString(KEY_SCREEN_TIME_LIMIT_APPLIED_DATE, value).apply()

    fun clear() = prefs.edit().clear().apply()

    companion object {
        private const val KEY_DEVICE_TOKEN = "device_token"
        private const val KEY_API_BASE_URL = "api_base_url"
        private const val KEY_LAST_REPORTED_MANAGEMENT_MODE = "last_reported_management_mode"
        private const val KEY_LAST_REPORTED_FCM_TOKEN = "last_reported_fcm_token"
        private const val KEY_SCREEN_TIME_LIMIT_MINUTES = "screen_time_limit_minutes"
        private const val KEY_SCREEN_TIME_LIMIT_APPLIED_DATE = "screen_time_limit_applied_date"
    }
}
