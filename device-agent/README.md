# Device Agent (اندروید، Kotlin)

نسخه MVP — Outbox Pull Pattern واقعی پیاده‌سازی شده؛ با Device Admin عادی (نه Device Owner کامل)
برای قفل/پاک‌سازی واقعی از راه دور.

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
- **تایید محلی امضای Ed25519** هر دستور (`CommandSigner.kt`، با کتابخانه Pure Java
  `net.i2p.crypto:eddsa`) — پورت دقیق Kotlin از `backend/src/common/crypto/command-signer.service.ts`،
  با یک تست مقدار طلایی مشترک بین هر دو زبان (`CommandSignerTest.kt` ⇄
  `command-signer.service.spec.ts`) که سازگاری کامل را تایید می‌کند. Device Agent فقط کلید عمومی
  سرور را دارد (`COMMAND_SIGNING_PUBLIC_KEY_HEX`، غیرمحرمانه)؛ کلید خصوصی هرگز در APK نیست، پس
  Decompile کردن APK دیگر امکان جعل دستور نمی‌دهد. دستوری که امضایش تایید نشود هرگز اجرا نمی‌شود.
- دستوراتی که بدون هیچ مجوز مدیریتی خاصی هم ممکن‌اند واقعاً اجرا می‌شوند: `sync_policy` (دریافت
  Policy)، `force_location_update` (گزارش موقعیت از `LocationManager`)، `send_parent_message`
  (نوتیفیکیشن)، `remote_alarm` (لرزش + نوتیفیکیشن).
- **Device Admin عادی برای قفل/پاک‌سازی واقعی**: از صفحه اصلی (`MainActivity`)، دکمه «فعال‌سازی
  مدیر دستگاه» دیالوگ استاندارد اندروید (`DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN`، گیرنده
  `admin/DeviceAgentAdminReceiver.kt`) را باز می‌کند — بدون نیاز به Provisioning یا Factory Reset.
  وقتی فعال باشد، `lock_device` واقعاً `DevicePolicyManager.lockNow()` و `wipe_data` واقعاً
  `DevicePolicyManager.wipeData()` را صدا می‌زند (`CommandExecutor.kt`)؛ اگر فعال نباشد، دلیل
  دقیق (نیاز به فعال‌سازی) در FAILED گزارش می‌شود.
- دستورات نیازمند Device Owner کامل (`set_screen_time_limit`، `block_app`، `unblock_app`،
  `sleep_mode_enable/disable`) صادقانه `FAILED` گزارش می‌شوند با دلیل مشخص — نه ادعای اجرای
  ساختگی. `unlock_device` در هیچ حالتی (حتی Device Owner) از طریق API اندروید ممکن نیست؛ این
  محدودیت پلتفرم است، نه کمبود پیاده‌سازی — همیشه FAILED با همین توضیح گزارش می‌شود.

## آیتم باز شناخته‌شده (پیشین) — Enrollment با QR: حل شد

نسخه قبلی این بخش می‌گفت مسیر امن انتقال Device Token از اپ والد به این دستگاه (از طریق QR)
پیاده‌سازی نشده. اکنون `QrScanActivity` (CameraX + ML Kit Barcode Scanning) و `EnrollmentQr.kt`
این مسیر را واقعاً پیاده می‌کنند — جزئیات بالا.

## آیتم باز شناخته‌شده (پیشین) — قفل/پاک‌سازی واقعی دستگاه: تا حد Device Admin حل شد

نسخه قبلی این بخش می‌گفت `lock_device`/`wipe_data` نیازمند Device Owner Mode‌اند که هنوز اضافه
نشده. اکنون مشخص شد این دو دستور مشخصاً با Device Admin عادی (بدون Provisioning) هم ممکن‌اند و
پیاده‌سازی شدند — جزئیات بالا. آیتم باز واقعی، Device Owner Mode کامل برای بقیه دستورات (زیر)،
هنوز به قوت خودش باقی است.

## آیتم باز شناخته‌شده (پیشین) — Ed25519: حل شد

نسخه قبلی این بخش می‌گفت امضای دستورات هنوز HMAC متقارن (کلید مشترک) است و مسیر ارتقا به Ed25519
غیرمتقارن اجرا نشده. اکنون CommandSignerService سمت بک‌اند با Ed25519 امضا می‌کند و این Device
Agent با `net.i2p.crypto:eddsa` (چون پشتیبانی بومی اندروید از Ed25519 فقط از API 33 به بعد است)
فقط با کلید عمومی تایید می‌کند — جزئیات بالا. توجه: این یک کلید سراسری سرور است (نه کلید
اختصاصی به‌ازای هر دستگاه)؛ امضای اختصاصی به‌ازای هر دستگاه (ستون رزروشده `device_public_key` در
Entity Device) هنوز یک آیتم باز جداگانه و بزرگ‌تر است (نیازمند توزیع/چرخش کلید per-device).

## آیتم‌های باز (صادقانه، نه ادعای کامل بودن)

1. **Device Owner Mode کامل**: برای اجرای واقعی `set_screen_time_limit`/`block_app`/
   `unblock_app`/`sleep_mode_enable/disable` باید Provisioning کامل (QR Provisioning هنگام
   Factory Reset + `DevicePolicyManager.setDeviceOwner`) اضافه شود — این یک QR Provisioning
   جداست (مخصوص Factory Reset، قبل از هر Setup)، نه همان QR Enrollment یا Device Admin عادی که
   قبلاً حل شدند.
2. **ابلاغ Real-Time**: فعلاً فقط Polling هر ۱۵ دقیقه‌ای وجود دارد؛ FCM Push برای ابلاغ فوری (مثل
   SYNC_POLICY) هنوز اضافه نشده — این نیازمند یک حساب/پروژه Firebase واقعی است که هنوز تصمیم‌گیری
   نشده (تصمیمی که آگاهانه به کاربر پروژه واگذار شده، نه چیزی که بی‌صدا گرفته شود).
3. **کلید Ed25519 سراسری، نه به‌ازای هر دستگاه**: همان‌طور که بالا گفته شد، همه نسخه‌های Device
   Agent یک کلید عمومی مشترک دارند؛ اگر کلید خصوصی سرور لو برود، همه دستگاه‌ها باید با Build جدید
   به‌روزرسانی شوند (چرخش یکباره، نه به‌ازای هر دستگاه).
4. **بدون تست خودکار واقعی برای خود دوربین/Device Admin**: مثل `mobile_scanner` در مسیر Flutter،
   چون `QrScanActivity` و فعال‌سازی Device Admin از API واقعی اندروید (نیازمند دستگاه/امولاتور)
   استفاده می‌کنند، در `./gradlew test` (JVM خالص) قابل اجرا نیستند — فقط منطق خالص (پارس QR در
   `EnrollmentQr.kt`، تایید امضای Ed25519 در `CommandSigner.kt`) تست خودکار دارد؛ خود صفحه اسکن
   و فعال‌سازی Device Admin باید دستی روی دستگاه واقعی تایید شوند.

## ساخت و تست

```bash
./gradlew test          # تست‌های خالص JVM (CommandSigner) — بدون نیاز به امولاتور
./gradlew assembleDebug  # کامپایل کامل APK
```

این دو دستور در CI (`.github/workflows/device-agent-ci.yml`) روی هر Push واقعاً اجرا و تایید
می‌شوند — نه فقط ادعا.
