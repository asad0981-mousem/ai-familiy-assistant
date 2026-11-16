package com.aifamily.deviceagent.security

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class EnrollmentQrTest {

    @Test
    fun `parses valid two-line payload with https base url`() {
        val result = EnrollmentQr.parse("https://api.example.com/api/v1/\nabc123deviceToken")

        assertEquals("https://api.example.com/api/v1/", result?.apiBaseUrl)
        assertEquals("abc123deviceToken", result?.deviceToken)
    }

    @Test
    fun `parses valid payload with http base url (local dev emulator)`() {
        val result = EnrollmentQr.parse("http://10.0.2.2:3000/api/v1/\ntoken-xyz")

        assertEquals("http://10.0.2.2:3000/api/v1/", result?.apiBaseUrl)
        assertEquals("token-xyz", result?.deviceToken)
    }

    @Test
    fun `trims whitespace around each line`() {
        val result = EnrollmentQr.parse("  https://api.example.com/api/v1/  \n  token-123  \n")

        assertEquals("https://api.example.com/api/v1/", result?.apiBaseUrl)
        assertEquals("token-123", result?.deviceToken)
    }

    @Test
    fun `ignores extra blank lines`() {
        val result = EnrollmentQr.parse("\nhttps://api.example.com/api/v1/\n\ntoken-123\n\n")

        assertEquals("https://api.example.com/api/v1/", result?.apiBaseUrl)
        assertEquals("token-123", result?.deviceToken)
    }

    @Test
    fun `returns null for unrelated single-line qr content`() {
        val result = EnrollmentQr.parse("https://some-other-website.com")

        assertNull(result)
    }

    @Test
    fun `returns null when base url has no http or https scheme`() {
        val result = EnrollmentQr.parse("api.example.com/api/v1/\ntoken-123")

        assertNull(result)
    }

    @Test
    fun `returns null when device token line is empty`() {
        val result = EnrollmentQr.parse("https://api.example.com/api/v1/\n   ")

        assertNull(result)
    }

    @Test
    fun `returns null for null input`() {
        val result = EnrollmentQr.parse(null)

        assertNull(result)
    }

    @Test
    fun `returns null for empty string`() {
        val result = EnrollmentQr.parse("")

        assertNull(result)
    }

    @Test
    fun `returns null for a childLogin-style bare uuid qr from the child app`() {
        // کد ورود کودک (QR دیگری، تولیدشده توسط mobile-parent برای mobile-child) فقط یک UUID خام
        // است؛ این کلاس باید آن را هم نادیده بگیرد، نه این‌که اشتباهاً به‌عنوان Enrollment بپذیرد.
        val result = EnrollmentQr.parse("3fa85f64-5717-4562-b3fc-2c963f66afa6")

        assertNull(result)
    }
}
