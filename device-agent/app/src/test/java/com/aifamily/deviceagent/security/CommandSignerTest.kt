package com.aifamily.deviceagent.security

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * تست خالص JVM (بدون نیاز به امولاتور/دستگاه اندروید) — می‌تواند در GitHub Actions با
 * `./gradlew test` اجرا شود، دقیقاً مثل الگوی Jest در بک‌اند.
 *
 * مهم‌ترین تست این فایل، تست مقدار طلایی (Golden Value) است: همان secret/payload دقیقی که در
 * backend/src/common/crypto/command-signer.service.spec.ts استفاده شده، با همان امضای HMAC
 * منتظره. اگر این دو پیاده‌سازی (TypeScript سرور و Kotlin Device Agent) از هم واگرا شوند،
 * این تست در یکی از دو سمت قرمز می‌شود — چیزی که هیچ تست تک‌زبانه نمی‌تواند تضمین کند.
 */
class CommandSignerTest {

    private val secret = "test-signing-secret-at-least-32-chars"

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

        val signature = CommandSigner.sign(secret, payload)

        assertEquals(64, signature.length)
        assertEquals(
            "8a4e424de4662c65ef250842771f5be7bde259d51537339da48c81b879f39974",
            signature,
        )
    }

    @Test
    fun `sign then verify succeeds for the same payload`() {
        val payload = mapOf("deviceId" to "d1", "type" to "lock_device", "idempotencyKey" to "k1")
        val signature = CommandSigner.sign(secret, payload)
        assertTrue(CommandSigner.verify(secret, payload, signature))
    }

    @Test
    fun `signature independent of top-level key order`() {
        val a = mapOf("deviceId" to "d1", "type" to "lock_device")
        val b = mapOf("type" to "lock_device", "deviceId" to "d1")
        assertEquals(CommandSigner.sign(secret, a), CommandSigner.sign(secret, b))
    }

    @Test
    fun `signature independent of nested payload key order (simulating jsonb round-trip)`() {
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

        val signature = CommandSigner.sign(secret, original)
        assertTrue(CommandSigner.verify(secret, rehydratedFromApi, signature))
    }

    @Test
    fun `array element order is meaningful`() {
        val a = mapOf("deviceId" to "d1", "blockedApps" to listOf("com.a", "com.b"))
        val b = mapOf("deviceId" to "d1", "blockedApps" to listOf("com.b", "com.a"))
        assertFalse(CommandSigner.sign(secret, a) == CommandSigner.sign(secret, b))
    }

    @Test
    fun `tampered payload fails verification`() {
        val payload = mapOf("deviceId" to "d1", "type" to "lock_device")
        val signature = CommandSigner.sign(secret, payload)
        val tampered = mapOf("deviceId" to "d1", "type" to "unlock_device")
        assertFalse(CommandSigner.verify(secret, tampered, signature))
    }

    @Test
    fun `forged or truncated signature rejected without throwing`() {
        val payload = mapOf("deviceId" to "d1", "type" to "lock_device")
        assertFalse(CommandSigner.verify(secret, payload, "not-a-real-signature"))
    }
}
