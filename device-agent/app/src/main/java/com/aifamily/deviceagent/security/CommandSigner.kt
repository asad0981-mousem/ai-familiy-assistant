package com.aifamily.deviceagent.security

import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * تایید محلی امضای HMAC-SHA256 دستورات دریافتی از سرور — پورت دقیق Kotlin از
 * backend/src/common/crypto/command-signer.service.ts (تابع canonicalize + HMAC-SHA256).
 *
 * نکته امنیتی حیاتی: کلید استفاده‌شده اینجا (COMMAND_SIGNING_SECRET) باید مجزا از هر Secret
 * مربوط به توکن JWT باشد. اگر Device Agent به کلید امضای JWT سرور دسترسی داشته باشد، عملاً
 * می‌تواند توکن‌های دلخواه (از جمله توکن والد) جعل کند — این یک باگ امنیتی واقعی بود که قبل از
 * نوشتن این فایل در خود بک‌اند پیدا و رفع شد (کامیت جداگانه).
 *
 * الگوریتم باید بایت‌به‌بایت با نسخه TypeScript یکسان باشد؛ سازگاری با یک تست مقدار طلایی
 * (Golden Value) مشترک در CommandSignerTest.kt و command-signer.service.spec.ts تایید می‌شود.
 *
 * عمداً بدون وابستگی به org.json/android.* — این کلاس فقط با نوع‌های ساده Kotlin
 * (Map/List/String/Number/Boolean/null) کار می‌کند تا به‌صورت خالص روی JVM (بدون نیاز به
 * Robolectric یا دستگاه/امولاتور) در Unit Test واقعی قابل اجرا باشد.
 */
object CommandSigner {

    /**
     * سریالایز Canonical بازگشتی — دقیقاً معادل تابع canonicalize در CommandSignerService:
     * در هر سطح، کلیدهای Map به‌صورت الفبایی مرتب می‌شوند؛ ترتیب عناصر List حفظ می‌شود (معنادار است).
     */
    fun canonicalize(value: Any?): String = when (value) {
        null -> "null"
        is Map<*, *> -> {
            val entries = value.entries
                .map { (k, v) -> k.toString() to v }
                .sortedBy { it.first }
                .joinToString(",") { (k, v) -> "${jsonString(k)}:${canonicalize(v)}" }
            "{$entries}"
        }
        is List<*> -> value.joinToString(",", prefix = "[", postfix = "]") { canonicalize(it) }
        is String -> jsonString(value)
        is Boolean -> value.toString()
        is Int, is Long -> value.toString()
        is Double -> formatNumber(value)
        is Float -> formatNumber(value.toDouble())
        else -> throw IllegalArgumentException(
            "نوع پشتیبانی‌نشده در canonicalize: ${value::class.java} — فقط Map/List/String/Number/Boolean/null مجاز است",
        )
    }

    /** اعداد صحیح را بدون ".0" و اعشاری‌ها را مثل JSON.stringify جاوااسکریپت چاپ می‌کند. */
    private fun formatNumber(value: Double): String =
        if (value == Math.floor(value) && !value.isInfinite()) value.toLong().toString() else value.toString()

    /** Escape رشته مطابق قواعد JSON (معادل JSON.stringify برای یک رشته ساده در Node.js). */
    private fun jsonString(value: String): String {
        val sb = StringBuilder("\"")
        for (c in value) {
            when (c) {
                '"' -> sb.append("\\\"")
                '\\' -> sb.append("\\\\")
                '\n' -> sb.append("\\n")
                '\r' -> sb.append("\\r")
                '\t' -> sb.append("\\t")
                else -> if (c.code < 0x20) {
                    sb.append(String.format("\\u%04x", c.code))
                } else {
                    sb.append(c)
                }
            }
        }
        sb.append("\"")
        return sb.toString()
    }

    private fun hmacSha256Hex(secret: String, message: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
        val raw = mac.doFinal(message.toByteArray(Charsets.UTF_8))
        return raw.joinToString("") { "%02x".format(it) }
    }

    fun sign(secret: String, payload: Map<String, Any?>): String =
        hmacSha256Hex(secret, canonicalize(payload))

    /**
     * مقایسه در زمان ثابت (Timing-Safe) — معادل crypto.timingSafeEqual سمت سرور؛
     * جلوگیری از نشت اطلاعات از طریق Timing Attack حتی در تایید محلی سمت دستگاه.
     */
    fun verify(secret: String, payload: Map<String, Any?>, signature: String): Boolean {
        val expected = sign(secret, payload)
        if (expected.length != signature.length) return false
        return MessageDigest.isEqual(
            expected.toByteArray(Charsets.UTF_8),
            signature.toByteArray(Charsets.UTF_8),
        )
    }
}
