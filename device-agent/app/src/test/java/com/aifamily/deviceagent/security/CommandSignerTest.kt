package com.aifamily.deviceagent.security

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * تست خالص JVM (بدون نیاز به امولاتور/دستگاه اندروید، چون net.i2p.crypto:eddsa هم Pure Java
 * است) — می‌تواند در GitHub Actions با `./gradlew test` اجرا شود، دقیقاً مثل الگوی Jest در بک‌اند.
 *
 * مهم‌ترین تست این فایل، تست مقدار طلایی (Golden Value) است: همان Seed خصوصی/کلید عمومی/payload/
 * امضای دقیقی که در backend/src/common/crypto/command-signer.service.spec.ts استفاده شده. اگر این
 * دو پیاده‌سازی (TypeScript سرور با crypto.sign بومی Node، و Kotlin Device Agent با
 * net.i2p.crypto:eddsa) از هم واگرا شوند، این تست در یکی از دو سمت قرمز می‌شود — چیزی که هیچ
 * تست تک‌زبانه نمی‌تواند تضمین کند.
 */
class CommandSignerTest {

    // کلید عمومی متناظر با Seed خصوصی تست "01"×32 که در command-signer.service.spec.ts استفاده شده.
    private val goldenPublicKeyHex = "8a88e3dd7409f195fd52db2d3cba5d72ca6709bf1d94121bf3748801b40f6f5c"
    private val goldenSignatureHex =
        "fff3499feb311c49f3763c8ee29934f15cecf5ffde6dbe9de7937239feeaeaaa98c56af0117cf0205998c38953275dd92a550f752ed7cd8c829bd221a34b6a0f"

    @Test
    fun `golden value cross-language compatible with TypeScript implementation`() {
        val payload: Map<String, Any?> = mapOf(
            "deviceId" to "11111111-1111-1111-1111-111111111111",
            "type" to "sync_policy",
            "idempotencyKey" to "22222222-2222-2222-2222-222222222222",
            "payload" to mapOf(
                "reason" to "policy_updated",
                "policyVersion" to 3,
                "blockedApps" to listOf("com.a", "com.b"),
            ),
        )

        assertTrue(CommandSigner.verify(goldenPublicKeyHex, payload, goldenSignatureHex))
    }

    @Test
    fun `signature independent of top-level key order (simulating jsonb round-trip)`() {
        val payload = mapOf(
            "deviceId" to "11111111-1111-1111-1111-111111111111",
            "idempotencyKey" to "22222222-2222-2222-2222-222222222222",
            "type" to "sync_policy",
            "payload" to mapOf(
                "blockedApps" to listOf("com.a", "com.b"),
                "policyVersion" to 3,
                "reason" to "policy_updated",
            ),
        )

        assertTrue(CommandSigner.verify(goldenPublicKeyHex, payload, goldenSignatureHex))
    }

    @Test
    fun `tampered payload fails verification`() {
        val tampered = mapOf(
            "deviceId" to "11111111-1111-1111-1111-111111111111",
            "type" to "unlock_device", // تغییر یافته نسبت به مقدار اصلی امضاشده
            "idempotencyKey" to "22222222-2222-2222-2222-222222222222",
            "payload" to mapOf(
                "reason" to "policy_updated",
                "policyVersion" to 3,
                "blockedApps" to listOf("com.a", "com.b"),
            ),
        )

        assertFalse(CommandSigner.verify(goldenPublicKeyHex, tampered, goldenSignatureHex))
    }

    @Test
    fun `array element order is meaningful`() {
        val payload = mapOf(
            "deviceId" to "11111111-1111-1111-1111-111111111111",
            "type" to "sync_policy",
            "idempotencyKey" to "22222222-2222-2222-2222-222222222222",
            "payload" to mapOf(
                "reason" to "policy_updated",
                "policyVersion" to 3,
                "blockedApps" to listOf("com.b", "com.a"), // جابه‌جاشده نسبت به مقدار امضاشده اصلی
            ),
        )

        assertFalse(CommandSigner.verify(goldenPublicKeyHex, payload, goldenSignatureHex))
    }

    @Test
    fun `forged or truncated signature rejected without throwing`() {
        val payload = mapOf("deviceId" to "d1", "type" to "lock_device")
        assertFalse(CommandSigner.verify(goldenPublicKeyHex, payload, "not-a-real-signature"))
    }

    @Test
    fun `malformed public key rejected without throwing`() {
        val payload = mapOf("deviceId" to "d1", "type" to "lock_device")
        assertFalse(CommandSigner.verify("not-a-real-public-key", payload, goldenSignatureHex))
    }

    @Test
    fun `signature with correct length but wrong bytes fails`() {
        val payload = mapOf("deviceId" to "d1", "type" to "lock_device")
        val wrongButSameLength = "0".repeat(128)
        assertFalse(CommandSigner.verify(goldenPublicKeyHex, payload, wrongButSameLength))
    }

    @Test
    fun `canonicalize is independent of nested payload key order`() {
        val original = mapOf(
            "deviceId" to "d1",
            "type" to "sync_policy",
            "idempotencyKey" to "k1",
            "payload" to mapOf("reason" to "policy_updated", "policyVersion" to 3),
        )
        val rehydratedFromApi = mapOf(
            "payload" to mapOf("policyVersion" to 3, "reason" to "policy_updated"),
            "idempotencyKey" to "k1",
            "deviceId" to "d1",
            "type" to "sync_policy",
        )

        assertEqualsCanonical(original, rehydratedFromApi)
    }

    private fun assertEqualsCanonical(a: Map<String, Any?>, b: Map<String, Any?>) {
        org.junit.Assert.assertEquals(CommandSigner.canonicalize(a), CommandSigner.canonicalize(b))
    }
}
