// Device Agent — ماژول اپلیکیشن اندروید.
// وابستگی‌ها عمداً حداقلی نگه داشته شده‌اند (بدون Retrofit/Moshi/Hilt) تا سطح خطر Resolve شدن
// در CI پایین بماند: org.json در خود پلتفرم اندروید موجود است، نیازی به کتابخانه سریالایز جدا نیست.
// استثنای آگاهانه: CameraX + ML Kit Barcode Scanning (هر دو از google() Resolve می‌شوند، همان
// Repository که Material/AndroidX را هم تامین می‌کند) برای اسکن واقعی QR Enrollment در
// QrScanActivity — این دو فقط برای همین صفحه اضافه شده‌اند، نه یک چارچوب عمومی‌تر.
// استثنای آگاهانه دوم: net.i2p.crypto:eddsa — پشتیبانی بومی Ed25519 در اندروید فقط از API 33
// به بعد اضافه شده (minSdk این اپ ۲۶ است)، پس برای تایید امضای Ed25519 دستورات سرور (جایگزین
// HMAC قبلی) یک کتابخانه Pure Java سبک و بدون وابستگی اضافه لازم بود.
// استثنای آگاهانه سوم: Firebase Cloud Messaging (firebase-messaging) — برای ابلاغ Real-Time
// مکمل CommandPollWorker. google-services.json این پوشه یک Placeholder ساختاری معتبر است (برای
// موفق‌شدن Build/CI)، نه یک پروژه واقعی Firebase — محدودیت صادقانه کامل در README این پوشه.

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.aifamily.deviceagent"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.aifamily.deviceagent"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // کلید عمومی Ed25519 سرور (۶۴ کاراکتر Hex، غیرمحرمانه) برای تایید محلی امضای دستورات —
        // باید دقیقاً همان publicKeyHex باشد که CommandSignerService سمت بک‌اند از روی
        // COMMAND_SIGNING_PRIVATE_KEY_HEX مشتق می‌کند. در Build واقعی باید از local.properties/CI
        // Secret خوانده شود، نه هاردکد در سورس. مقدار پیش‌فرض اینجا دقیقاً متناظر با کلید خصوصی
        // پیش‌فرض ناامن توسعه (backend/src/config/configuration.ts) است تا اجرای محلی سرور+اپ
        // بدون تنظیم دستی هم کار کند.
        buildConfigField(
            "String",
            "COMMAND_SIGNING_PUBLIC_KEY_HEX",
            "\"${project.findProperty("COMMAND_SIGNING_PUBLIC_KEY_HEX") ?: "8139770ea87d175f56a35466c34c7ecccb8d8a91b4ee37a25df60f5b8fc9b394"}\"",
        )
        buildConfigField(
            "String",
            "DEFAULT_API_BASE_URL",
            "\"${project.findProperty("API_BASE_URL") ?: "http://10.0.2.2:3000/api/v1/"}\"",
        )
    }

    buildFeatures {
        buildConfig = true
        viewBinding = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.activity:activity-ktx:1.9.0")

    // WorkManager — برای Polling دوره‌ای دستورات (Outbox Pull Pattern) حتی وقتی اپ در فورگراند نیست.
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // EncryptedSharedPreferences — ذخیره امن deviceToken/Secret در Keystore محلی.
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // HTTP Client سبک برای فراخوانی API بک‌اند.
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // CameraX — پیش‌نمایش دوربین زنده برای صفحه اسکن QR Enrollment.
    implementation("androidx.camera:camera-core:1.3.4")
    implementation("androidx.camera:camera-camera2:1.3.4")
    implementation("androidx.camera:camera-lifecycle:1.3.4")
    implementation("androidx.camera:camera-view:1.3.4")

    // ML Kit Barcode Scanning — تشخیص QR Code از فریم‌های دوربین (کاملاً On-Device، بدون شبکه).
    implementation("com.google.mlkit:barcode-scanning:17.3.0")

    // Ed25519 — تایید امضای دستورات سرور؛ Pure Java (بدون وابستگی native)، پس در تست خالص JVM
    // (./gradlew test) هم قابل استفاده است، نه فقط Instrumented Test.
    implementation("net.i2p.crypto:eddsa:0.3.0")

    // FCM Push — ابلاغ Real-Time (مکمل CommandPollWorker، نه جایگزین). BoM نسخه همه artifact های
    // Firebase را هماهنگ می‌کند. از نسخه‌های جدیدتر BoM به بعد، افزونه‌های KTX داخل خود artifact
    // اصلی ادغام شده‌اند (دیگر firebase-messaging-ktx جداگانه منتشر نمی‌شود) — پس فقط
    // firebase-messaging لازم است (نه Analytics/Crashlytics و...، چون این اپ عمداً حداقلی نگه
    // داشته شده، بدون نیاز به یک فریمورک تحلیلی جداگانه).
    implementation(platform("com.google.firebase:firebase-bom:35.2.0"))
    implementation("com.google.firebase:firebase-messaging")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
