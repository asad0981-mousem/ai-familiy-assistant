// AI Family Assistant — Device Agent (اندروید Native، Kotlin)
// پروژه ریشه فقط پلاگین‌ها را برای ماژول app اعلام می‌کند (طبق الگوی استاندارد Gradle چندماژوله).

plugins {
    id("com.android.application") version "8.7.0" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    // برای خواندن app/google-services.json و تولید مقادیر Firebase در Build-Time (FCM Push) —
    // جزئیات محدودیت صادقانه در app/google-services.json و README این پوشه.
    id("com.google.gms.google-services") version "4.5.0" apply false
}
