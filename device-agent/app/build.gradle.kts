// Device Agent — ماژول اپلیکیشن اندروید.
// وابستگی‌ها عمداً حداقلی نگه داشته شده‌اند (بدون Retrofit/Moshi/Hilt) تا سطح خطر Resolve شدن
// در CI پایین بماند: org.json در خود پلتفرم اندروید موجود است، نیازی به کتابخانه سریالایز جدا نیست.

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
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

        // کلید امضای HMAC دستورات — مستقل از هر Secret سرور (JWT و...)؛ فقط برای تایید محلی امضا.
        // در Build واقعی باید از local.properties/CI Secret خوانده شود، نه هاردکد در سورس.
        buildConfigField(
            "String",
            "COMMAND_SIGNING_SECRET",
            "\"${project.findProperty("COMMAND_SIGNING_SECRET") ?: "insecure-dev-only-command-signing-secret"}\"",
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

    // WorkManager — برای Polling دوره‌ای دستورات (Outbox Pull Pattern) حتی وقتی اپ در فورگراند نیست.
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // EncryptedSharedPreferences — ذخیره امن deviceToken/Secret در Keystore محلی.
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // HTTP Client سبک برای فراخوانی API بک‌اند.
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
