# Device Agent (اندروید، Kotlin)

نسخه MVP — Outbox Pull Pattern واقعی پیاده‌سازی شده، اما بدون Device Owner Mode.

## چه چیزی واقعاً کار می‌کند

- **Enrollment با اسکن QR یا ورودی دستی**: در `EnrollmentActivity` دکمه «اسکن کد QR به‌جای تایپ
  دستی» صفحه `QrScanActivity` (CameraX + ML Kit Barcode Scanning، کاملاً On-Device) را باز می‌کند؛
  QR نمایش‌داده‌شده در اپ والد (دو خط: آدرس سرور + Device Token) اسکن و در دو فیلد پر می‌شود. پارس
  محتوای QR در `security/EnrollmentQr.kt` به‌صورت Kotlin خالص (بدون org.json/android.*) نوشته شده
  تا با تست واحد JVM (`EnrollmentQrTest.kt`) قابل‌تایید باشد. ورودی دستی هم همچنان کار می‌کند.
  نتیجه نهایی (آدرس سرور + Device Token) در `EncryptedSharedPreferences` (پشتیبان Android
  Keystore) ذخیره می‌شود.
- **CommandPollWorker**: هر ۱۵ دقیقه (حداقل بازه واقعی `PeriodicWorkRequest` در اندروید) `GET
  /devices/commands/pending` را صدا می‌زند.
- **تایید محلی امضای HMAC-SHA256** هر دستور (`CommandSigner.kt`) — پورت دقیق Kotlin از
  `backend/src/common/crypto/command-signer.service.ts`، با یک تست مقدار طلایی مشترک بین هر دو
  زبان (`CommandSignerTest.kt` ⇄ `command-signer.service.spec.ts`) که سازگاری کامل را تایید می‌کند.
  دستوری که امضایش تایید نشود هرگز اجرا نمی‌شود.
- دستوراتی که بدون Device Owner هم ممکن‌اند واقعاً اجرا می‌شوند: `sync_policy` (دریافت Policy)،
  `force_location_update` (گزارش موقعیت از `LocationManager`)، `send_parent_message` (نوتیفیکیشن)،
  `remote_alarm` (لرزش + نوتیفیکیشن).
- دستورات نیازمند Device Owner (`lock_device`، `unlock_device`، `set_screen_time_limit`،
  `block_app`، `unblock_app`، `sleep_mode_enable/disable`، `wipe_data`) صادقانه `FAILED` گزارش
  می‌شوند با دلیل مشخص — نه ادعای اجرای ساختگی.

## آیتم باز شناخته‌شده (پیشین) — Enrollment با QR: حل شد

نسخه قبلی این بخش می‌گفت مسیر امن انتقال Device Token از اپ والد به این دستگاه (از طریق QR)
پیاده‌سازی نشده. اکنون `QrScanActivity` (CameraX + ML Kit Barcode Scanning) و `EnrollmentQr.kt`
این مسیر را واقعاً پیاده می‌کنند — جزئیات بالا.

## آیتم‌های باز (صادقانه، نه ادعای کامل بودن)

1. **Device Owner Mode**: برای اجرای واقعی دستورات مدیریتی (قفل/مسدودسازی/پاک‌سازی) باید
   Provisioning کامل (QR Provisioning هنگام Factory Reset + `DeviceAdminReceiver` +
   `DevicePolicyManager.setDeviceOwner`) اضافه شود — این یک QR Provisioning جداست (مخصوص
   Factory Reset)، نه همان QR Enrollment که بالا حل شد.
2. **ابلاغ Real-Time**: فعلاً فقط Polling هر ۱۵ دقیقه‌ای وجود دارد؛ FCM Push برای ابلاغ فوری (مثل
   SYNC_POLICY) هنوز اضافه نشده.
3. **Ed25519**: امضای فعلی HMAC متقارن است (کلید مشترک در APK Build) — مسیر ارتقای مستندشده در
   بک‌اند به امضای غیرمتقارن به‌ازای هر دستگاه هنوز اجرا نشده.
4. **بدون تست خودکار واقعی برای خود دوربین**: مثل `mobile_scanner` در مسیر Flutter، چون
   `QrScanActivity` از CameraX/ML Kit واقعی (نیازمند دستگاه/امولاتور با دوربین) استفاده می‌کند، در
   `./gradlew test` (JVM خالص) قابل اجرا نیست — فقط منطق پارس QR (`EnrollmentQr.kt`) تست خودکار
   دارد؛ خود صفحه اسکن باید دستی روی دستگاه واقعی تایید شود.

## ساخت و تست

```bash
./gradlew test          # تست‌های خالص JVM (CommandSigner) — بدون نیاز به امولاتور
./gradlew assembleDebug  # کامپایل کامل APK
```

این دو دستور در CI (`.github/workflows/device-agent-ci.yml`) روی هر Push واقعاً اجرا و تایید
می‌شوند — نه فقط ادعا.
