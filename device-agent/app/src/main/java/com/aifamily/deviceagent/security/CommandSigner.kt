package com.aifamily.deviceagent.security

import net.i2p.crypto.eddsa.EdDSAEngine
import net.i2p.crypto.eddsa.EdDSAPublicKey
import net.i2p.crypto.eddsa.spec.EdDSANamedCurveTable
import net.i2p.crypto.eddsa.spec.EdDSAPublicKeySpec
import java.security.MessageDigest

/**
 * تایید محلی امضای Ed25519 دستورات دریافتی از سرور — پورت دقیق Kotlin از
 * backend/src/common/crypto/command-signer.service.ts (تابع canonicalize + امضای Ed25519).
 *
 * ارتقا از HMAC-SHA256 قبلی: با HMAC، همان کلیدی که سرور برای امضا استفاده می‌کرد باید روی
 * Device Agent هم برای تایید موجود باشد — یعنی هرکس APK را Decompile می‌کرد به کلید امضا هم
 * دسترسی داشت و می‌توانست دستور جعل کند. با Ed25519، این کلاس فقط کلید عمومی سرور
 * (COMMAND_SIGNING_PUBLIC_KEY_HEX، غیرمحرمانه) را دارد؛ کلید خصوصی فقط روی سرور می‌ماند —
 * استخراج APK دیگر امکان جعل دستور نمی‌دهد (Non-repudiation واقعی).
 *
 * از کتابخانه net.i2p.crypto:eddsa استفاده شده (نه java.security.* بومی اندروید) چون پشتیبانی
 * بومی Ed25519 در اندروید فقط از API 33 (Android 13) به بعد اضافه شده؛ minSdk این اپ ۲۶ است.
 * این کتابخانه Pure Java (بدون وابستگی native یا android.*) است — دقیقاً مثل استثنای مستندشده
 * CameraX/ML Kit در build.gradle.kts، یک وابستگی خارجی آگاهانه و محدود، نه نقض فلسفه کلی کم‌وابستگی.
 *
 * الگوریتم Canonicalize باید بایت‌به‌بایت با نسخه TypeScript یکسان باشد؛ سازگاری با یک تست مقدار
 * طلایی (Golden Value) مشترک در CommandSignerTest.kt و command-signer.service.spec.ts تایید می‌شود.
 *
 * بخش Canonicalize عمداً بدون وابستگی به org.json/android.* — فقط با نوع‌های ساده Kotlin
 * (Map/List/String/Number/Boolean/null) کار می‌کند تا به‌صورت خالص روی JVM (بدون نیاز به
 * Robolectric یا دستگاه/امولاتور) در Unit Test واقعی قابل اجرا باشد؛ net.i2p.crypto:eddsa هم
 * Pure Java است، پس تایید امضا هم در همان تست خالص JVM قابل اجراست.
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

    private fun hexToBytes(hex: String): ByteArray {
        require(hex.length % 2 == 0) { "طول Hex باید زوج باشد" }
        return ByteArray(hex.length / 2) { i ->
            ((Character.digit(hex[i * 2], 16) shl 4) + Character.digit(hex[i * 2 + 1], 16)).toByte()
        }
    }

    /**
     * تایید امضای Ed25519 — [publicKeyHex] باید دقیقاً ۶۴ کاراکتر Hex (۳۲ بایت کلید عمومی خام)
     * و [signatureHex] دقیقاً ۱۲۸ کاراکتر Hex (۶۴ بایت امضا) باشد؛ هر ورودی بدشکل یا کلید/امضای
     * نامعتبر باعث false می‌شود، نه Exception — تا فراخوان (CommandPollWorker) همیشه بتواند
     * صادقانه دستور را FAILED گزارش کند، نه کرش کند.
     */
    fun verify(publicKeyHex: String, payload: Map<String, Any?>, signatureHex: String): Boolean {
        return try {
            if (!Regex("^[0-9a-fA-F]{64}$").matches(publicKeyHex)) return false
            if (!Regex("^[0-9a-fA-F]{128}$").matches(signatureHex)) return false

            val curveSpec = EdDSANamedCurveTable.getByName(EdDSANamedCurveTable.ED_25519)
            val publicKeySpec = EdDSAPublicKeySpec(hexToBytes(publicKeyHex), curveSpec)
            val publicKey = EdDSAPublicKey(publicKeySpec)

            val engine = EdDSAEngine(MessageDigest.getInstance(curveSpec.hashAlgorithm))
            engine.initVerify(publicKey)
            engine.update(canonicalize(payload).toByteArray(Charsets.UTF_8))
            engine.verify(hexToBytes(signatureHex))
        } catch (e: Exception) {
            false
        }
    }
}
