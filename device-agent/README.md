# Device Agent (اندروید، Kotlin)

نسخه MVP — Outbox Pull Pattern واقعی پیاده‌سازی شده، اما بدون Device Owner Mode.

## چه چیزی واقعاً کار می‌کند

- **Enrollment دستی**: آدرس سرور + Device Token به‌صورت دستی وارد می‌شود (آیتم باز زیر را ببینید) و در
  `EncryptedSharedPreferences` (پشتیبان Android Keystore) ذخیره می‌شود.
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

## آیتم‌های باز (صادقانه، نه ادعای کامل بودن)

1. **Enrollment واقعی (QR/Deep Link)**: بک‌اند توکن را مستقیم در پاسخ `POST /devices/enroll` به اپ
   والد برمی‌گرداند؛ مسیر امن انتقال آن توکن از اپ والد به این دستگاه (QR Code پیشنهادی) هنوز
   پیاده‌سازی نشده. فعلاً ورودی دستی جایگزین است.
2. **Device Owner Mode**: برای اجرای واقعی دستورات مدیریتی (قفل/مسدودسازی/پاک‌سازی) باید
   Provisioning کامل (QR Provisioning هنگام Factory Reset + `DeviceAdminReceiver` +
   `DevicePolicyManager.setDeviceOwner`) اضافه شود.
3. **ابلاغ Real-Time**: فعلاً فقط Polling هر ۱۵ دقیقه‌ای وجود دارد؛ FCM Push برای ابلاغ فوری (مثل
   SYNC_POLICY) هنوز اضافه نشده.
4. **Ed25519**: امضای فعلی HMAC متقارن است (کلید مشترک در APK Build) — مسیر ارتقای مستندشده در
   بک‌اند به امضای غیرمتقارن به‌ازای هر دستگاه هنوز اجرا نشده.

## ساخت و تست

```bash
./gradlew test          # تست‌های خالص JVM (CommandSigner) — بدون نیاز به امولاتور
./gradlew assembleDebug  # کامپایل کامل APK
```

این دو دستور در CI (`.github/workflows/device-agent-ci.yml`) روی هر Push واقعاً اجرا و تایید
می‌شوند — نه فقط ادعا.
