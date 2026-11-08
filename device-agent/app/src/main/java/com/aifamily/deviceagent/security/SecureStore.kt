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

    fun clear() = prefs.edit().clear().apply()

    companion object {
        private const val KEY_DEVICE_TOKEN = "device_token"
        private const val KEY_API_BASE_URL = "api_base_url"
    }
}
