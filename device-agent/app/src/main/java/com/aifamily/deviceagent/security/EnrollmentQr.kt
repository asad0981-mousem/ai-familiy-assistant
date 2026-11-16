package com.aifamily.deviceagent.security

/**
 * پارس محتوای QR Code اتصال دستگاه — عمداً بدون وابستگی به org.json/android.* (مطابق همان
 * محدودیت مستندشده در CommandSigner.kt) تا این منطق با تست خالص JVM (`./gradlew test`) قابل
 * اجرا باشد، بدون نیاز به Instrumented Test/امولاتور.
 *
 * قرارداد محتوای QR (تولیدشده توسط اپ والد، `_enrollDevice` در child_detail_screen.dart):
 * دو خط متن ساده — خط اول آدرس پایه API، خط دوم Device Token:
 *
 * ```
 * https://api.example.com/api/v1/
 * <deviceToken>
 * ```
 *
 * عمداً JSON انتخاب نشده (برخلاف فرمت نیازی به Parser جدا نیست) چون این دو مقدار از قبل در دو
 * فیلد متنی جدا (`apiBaseUrlInput`/`deviceTokenInput`) در EnrollmentActivity نمایش داده می‌شوند؛
 * خط‌شکستن ساده‌ترین قرارداد مشترک بین Dart (QrImageView) و Kotlin (این کلاس) است.
 */
object EnrollmentQr {

    /** نتیجه پارس موفق محتوای QR. */
    data class Payload(val apiBaseUrl: String, val deviceToken: String)

    /**
     * محتوای خام اسکن‌شده را پارس می‌کند. در صورت نامعتبر بودن (خطوط ناقص، آدرس غیر http/https،
     * یا Device Token خالی) مقدار null برمی‌گرداند — نه Exception، تا فراخوان (UI دوربین) بتواند
     * اسکن‌های نامربوط (مثل QR یک سایت دیگر) را بی‌صدا نادیده بگیرد و دوباره اسکن کند.
     */
    fun parse(rawValue: String?): Payload? {
        if (rawValue == null) return null

        val lines = rawValue.split("\n").map { it.trim() }.filter { it.isNotEmpty() }
        if (lines.size < 2) return null

        val apiBaseUrl = lines[0]
        val deviceToken = lines[1]

        if (!isValidBaseUrl(apiBaseUrl)) return null
        if (deviceToken.isEmpty()) return null

        return Payload(apiBaseUrl = apiBaseUrl, deviceToken = deviceToken)
    }

    private fun isValidBaseUrl(value: String): Boolean {
        return value.startsWith("http://") || value.startsWith("https://")
    }
}
