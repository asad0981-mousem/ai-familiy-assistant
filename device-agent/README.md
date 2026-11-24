# Device Agent (اندروید، Kotlin)

نسخه MVP — Outbox Pull Pattern واقعی پیاده‌سازی شده؛ با Device Admin عادی برای قفل/پاک‌سازی واقعی
از راه دور، و با Device Owner واقعی (فعال‌سازی از طریق ADB — جزئیات زیر) برای مسدودسازی اپ/حالت
خواب/محدودیت زمان صفحه.

## چه چیزی واقعاً کار می‌کند

- **Enrollment با اسکن QR یا ورودی دستی**: در `EnrollmentActivity` دکمه «اسکن کد QR به‌جای تایپ
  دستی» صفحه `QrScanActivity` (CameraX + ML Kit Barcode Scanning، کاملاً On-Device) را باز می‌کند؛
  QR نمایش‌داده‌شده در اپ والد (دو خط: آدرس سرور + Device Token) اسکن و در دو فیلد پر می‌شود. پارس
  محتوای QR در `security/EnrollmentQr.kt` به‌صورت Kotlin خالص (بدون org.json/android.*) نوشته شده
  تا با تست واحد JVM (`EnrollmentQrTest.kt`) قابل‌تایید باشد. ورودی دستی هم همچنان کار می‌کند.
  نتیجه نهایی (آدرس سرور + Device Token) در `EncryptedSharedPreferences` (پشتیبان Android
  Keystore) ذخیره می‌شود.
- **CommandPollWorker**: هر ۱۵ دقیقه (حداقل بازه واقعی `PeriodicWorkRequest` در اندروید) `GET
  /devices/commands/pending` را صدا می‌زند — این مسیر قابل‌اطمینان اصلی ابلاغ دستور است و با یا
  بدون FCM Push (زیر) کار می‌کند.
- **FCM Push برای ابلاغ فوری (مکمل، نه جایگزین Polling)**: `push/AiFamilyMessagingService.kt`
  (`FirebaseMessagingService`) توکن FCM را با `PATCH /devices/fcm-token` گزارش می‌دهد
  (`onNewToken`، به‌علاوه یک تلاش اضافه در `MainActivity.onCreate` برای توکنی که قبل از Enrollment
  از قبل وجود داشته)، و با دریافت هر Push (Data-only، بدون Notification قابل‌رویت) بلافاصله یک
  اجرای یک‌باره (نه دوره‌ای) از همان `CommandPollWorker` صف می‌کند — یعنی تاخیر ابلاغ از حداکثر ۱۵
  دقیقه به تقریباً آنی می‌رسد، اما اعتماد همچنان فقط از همان Pull امضاشده می‌آید (محتوای خود Push
  هرگز مستقیماً به‌عنوان دستور اجرا نمی‌شود). بک‌اند هم بعد از صف‌شدن هر دستور، تلاش Best-Effort
  برای ارسال این Push انجام می‌دهد (`common/push/push-notification.service.ts`).
  **وضعیت اتصال**: `app/google-services.json` اکنون فایل واقعی پروژه Firebase کاربر است
  (`ai-family-assistant-a9ad8`، Package Name تایید‌شده `com.aifamily.deviceagent`) — جزئیات در
  `app/google-services.json.README.md`. باقی‌مانده صادقانه: ارسال واقعی Push از سمت بک‌اند هنوز
  نیازمند تنظیم `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` (Service Account محرمانه، هرگز Commit
  نمی‌شود) در محیط واقعی بک‌اند است؛ بدون آن، منطق Graceful Degradation (تایید‌شده در CI) فعال
  می‌ماند و ابلاغ فقط از طریق Polling ۱۵‌دقیقه‌ای انجام می‌شود. تست End-to-End واقعی یک Push دستی
  (دستگاه فیزیکی/امولاتور با Google Play Services) هنوز در CI انجام نشده (محدودیت ذاتی این محیط
  Sandbox، نه نقص کد).
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
- **Device Owner واقعی برای مسدودسازی اپ/حالت خواب/محدودیت زمان صفحه**: `admin/DeviceOwnerStatus.kt`
  وضعیت واقعی را مستقیماً از `DevicePolicyManager.isDeviceOwnerApp()` می‌خواند (نه ادعا). وقتی
  فعال باشد:
  - `block_app`/`unblock_app`: با `DevicePolicyManager.setApplicationHidden` (`admin/AppSuspension.kt`)
    یک اپ مشخص (از `payload.packageName`) را پنهان/بازمی‌گرداند.
  - `sleep_mode_enable`/`sleep_mode_disable`: با `DevicePolicyManager.setPackagesSuspended` همه
    اپ‌های قابل‌اجرای کاربر (به‌جز خود Device Agent) را تعلیق/رفع‌تعلیق می‌کند.
  - `set_screen_time_limit`: چون اندروید هیچ API مستقیمی برای «محدودیت زمان روزانه» ندارد، مقدار
    `payload.screenTimeMinutesPerDay` در `SecureStore` ذخیره می‌شود و `ScreenTimeEnforcementWorker`
    (هر ۱۵ دقیقه) با `UsageStatsManager` زمان Foreground امروز را جمع می‌زند و در صورت عبور از حد،
    همه اپ‌ها را با همان `AppSuspension` تعلیق می‌کند — این Worker علاوه بر Device Owner، نیازمند
    دسترسی دستی «Usage Access» است (زیر را ببینید).
  - اگر Device Owner فعال نباشد، هر پنج دستور بالا صادقانه `FAILED` با دلیل مشخص گزارش می‌شوند — نه
    ادعای اجرای ساختگی.
  - **فعال‌سازی Device Owner در این نسخه** — بدون زیرساخت میزبانی APK عمومی برای QR/Zero-Touch
    Provisioning واقعی، تنها مسیر واقعی و تایید‌شده همین است (روی دستگاه/امولاتوری که هنوز هیچ
    حسابی به آن اضافه نشده):
    ```
    adb shell dpm set-device-owner com.aifamily.deviceagent/.admin.DeviceAgentAdminReceiver
    ```
    بعد از اجرای موفق، دستگاه خودش (نه والد، نه سرور) در Poll بعدی `CommandPollWorker` وضعیت واقعی
    را با `PATCH /devices/management-mode` به بک‌اند گزارش می‌دهد؛ `Device.managementMode`
    سمت سرور صرفاً بازتاب‌دهنده همین گزارش دستگاه است و پیش‌نیاز صف‌شدن پنج دستور بالاست
    (`DEVICE_OWNER_ONLY_COMMANDS` در `device-command.entity.ts`).
  - **دسترسی Usage Access**: `PACKAGE_USAGE_STATS` یک مجوز AppOps خاص است که حتی با Device Owner
    هم از طریق دیالوگ معمولی اعطا نمی‌شود؛ کاربر باید دستی از دکمه «فعال‌سازی دسترسی Usage Access»
    در صفحه اصلی (که `Settings.ACTION_USAGE_ACCESS_SETTINGS` را باز می‌کند) آن را فعال کند — بدون
    آن، `ScreenTimeEnforcementWorker` بدون خطا اما بدون اجرای واقعی محدودیت خارج می‌شود.
- `unlock_device` در هیچ حالتی (حتی Device Owner) از طریق API اندروید ممکن نیست؛ این محدودیت
  پلتفرم است، نه کمبود پیاده‌سازی — همیشه FAILED با همین توضیح گزارش می‌شود.

## آیتم باز شناخته‌شده (پیشین) — Enrollment با QR: حل شد

نسخه قبلی این بخش می‌گفت مسیر امن انتقال Device Token از اپ والد به این دستگاه (از طریق QR)
پیاده‌سازی نشده. اکنون `QrScanActivity` (CameraX + ML Kit Barcode Scanning) و `EnrollmentQr.kt`
این مسیر را واقعاً پیاده می‌کنند — جزئیات بالا.

## آیتم باز شناخته‌شده (پیشین) — قفل/پاک‌سازی واقعی دستگاه: تا حد Device Admin حل شد

نسخه قبلی این بخش می‌گفت `lock_device`/`wipe_data` نیازمند Device Owner Mode‌اند که هنوز اضافه
نشده. اکنون مشخص شد این دو دستور مشخصاً با Device Admin عادی (بدون Provisioning) هم ممکن‌اند و
پیاده‌سازی شدند — جزئیات بالا.

## آیتم باز شناخته‌شده (پیشین) — Device Owner Mode کامل: کد اجرا شده، Provisioning واقعی همچنان باز

نسخه‌های قبلی این بخش می‌گفتند `set_screen_time_limit`/`block_app`/`unblock_app`/
`sleep_mode_enable/disable` اصلاً پیاده‌سازی نشده‌اند. اکنون کد واقعی این پنج دستور (با
`DevicePolicyManager.setApplicationHidden`/`setPackagesSuspended` و `UsageStatsManager`) نوشته و
کامپایل شده است — جزئیات بالا. با این حال، **این بخش صادقانه مرز دقیق تایید‌شده را مشخص می‌کند**:

- تایید‌شده (کامپایل/Build در CI، `./gradlew assembleDebug`؛ منطق تایید امضا و پارس Payload با
  تست واحد JVM): کد هر پنج دستور، گزارش‌دهی `managementMode` به بک‌اند، و Gate سمت سرور
  (`DEVICE_OWNER_ONLY_COMMANDS`).
- **تایید‌نشده در CI** (نیازمند دستگاه/امولاتور واقعی با Device Owner فعال، که در GitHub Actions
  به‌صورت معنادار ممکن نیست): آیا فعال‌سازی واقعی `dpm set-device-owner` روی یک دستگاه واقعی کار
  می‌کند، آیا `setApplicationHidden`/`setPackagesSuspended` واقعاً اپی را روی یک دستگاه واقعی
  مسدود می‌کنند، و آیا `ScreenTimeEnforcementWorker` بعد از اعطای دستی Usage Access واقعاً محدودیت
  را اعمال می‌کند. اینها باید روی یک دستگاه/امولاتور واقعی دستی تست شوند.
- Zero-Touch/QR Provisioning واقعی هنگام Factory Reset (مسیر استاندارد توزیع در دنیای واقعی)
  همچنان پیاده‌سازی نشده — نیازمند میزبانی APK در یک آدرس عمومی پایدار است که این پروژه زیرساخت آن
  را ندارد. مسیر ADB بالا جایگزین واقعی و مستند آن برای این نسخه MVP است.

## آیتم باز شناخته‌شده (پیشین) — Ed25519: حل شد

نسخه قبلی این بخش می‌گفت امضای دستورات هنوز HMAC متقارن (کلید مشترک) است و مسیر ارتقا به Ed25519
غیرمتقارن اجرا نشده. اکنون CommandSignerService سمت بک‌اند با Ed25519 امضا می‌کند و این Device
Agent با `net.i2p.crypto:eddsa` (چون پشتیبانی بومی اندروید از Ed25519 فقط از API 33 به بعد است)
فقط با کلید عمومی تایید می‌کند — جزئیات بالا. توجه: این یک کلید سراسری سرور است (نه کلید
اختصاصی به‌ازای هر دستگاه)؛ امضای اختصاصی به‌ازای هر دستگاه (ستون رزروشده `device_public_key` در
Entity Device) هنوز یک آیتم باز جداگانه و بزرگ‌تر است (نیازمند توزیع/چرخش کلید per-device).

## آیتم‌های باز (صادقانه، نه ادعای کامل بودن)

1. **Zero-Touch/QR Provisioning واقعی هنگام Factory Reset**: کد اجرای پنج دستور Device
   Owner-محور نوشته شده (بالا)، اما فعال‌سازی واقعی Device Owner در این نسخه فقط از طریق ADB
   ممکن است، نه از طریق QR هنگام Factory Reset (نیازمند میزبانی APK در آدرس عمومی که این پروژه
   ندارد) — و رفتار واقعی روی دستگاه فیزیکی (نه فقط کامپایل) در CI تایید نشده است (جزئیات در بخش
   بالا).
2. **ابلاغ Real-Time با FCM Push — کد کامل، پروژه واقعی Firebase وصل شد؛ فقط Secret بک‌اند باقی‌مانده**:
   `app/google-services.json` اکنون فایل واقعی پروژه `ai-family-assistant` کاربر است (جزئیات
   بالا). آنچه باز مانده فقط تنظیم `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` (Service Account
   محرمانه) در محیط واقعی Deploy بک‌اند است — این مقدار به‌عمد هرگز در این مخزن Commit نمی‌شود،
   پس باید توسط خود کاربر در محیط Deploy واقعی‌اش تنظیم شود. تا آن زمان، ابلاغ همچنان کاملاً از
   طریق Polling هر ۱۵ دقیقه‌ای (قابل‌اطمینان و تست‌شده) انجام می‌شود؛ تست End-to-End واقعی یک Push
   دستی روی دستگاه فیزیکی/امولاتور در این محیط Sandbox ممکن نیست.
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
