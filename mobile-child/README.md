# اپ کودک (Flutter)

نسخه MVP — ورود با «کد ورود» (childId) + PIN (بدون ایمیل/رمز عبور)، و گفتگوی چت با AI Tutor.
این اپ همان آیتم بازی است که چند بار در این پروژه مطرح شده بود و همزمان مسیر «ورود واقعی کودک»
را هم با خودش حل کرده (پیاده‌سازی بک‌اند در `backend/src/modules/auth` — جزئیات در
README اصلی).

## چه چیزی واقعاً کار می‌کند

- `ApiClient` فقط دو مسیری که کودک واقعاً لازم دارد را پیاده می‌کند:
  `POST /auth/child-login` (ورود) و `POST /ai-tutor/messages` (گفتگو) — مستقیماً از خواندن
  `backend/src/modules/auth/auth.controller.ts` و `backend/src/modules/ai-tutor/tutor.controller.ts`
  استخراج شده، نه حدسی.
- `Session` نشست را با `flutter_secure_storage` ماندگار می‌کند؛ «کد ورود» (childId) جدا از
  توکن‌ها نگه‌داری می‌شود تا کودک بعد از اولین ورود فقط PIN را دوباره وارد کند، نه کل UUID را
  (`rememberedChildId`). والد می‌تواند از صفحه جزئیات فرزند در اپ والد («کد ورود اپ کودک») این
  مقدار را برای کودک نشان دهد.
- صفحه چت (`ChatScreen`) تاریخچه را فقط در حافظه همین اجرای اپ نگه می‌دارد (بک‌اند مسیر GET
  تاریخچه ندارد — فقط حافظه کوتاه‌مدت سمت سرور روی هر `conversationId`)، و همان `conversationId`
  پاسخ اول را برای پیام‌های بعدی دوباره می‌فرستد تا Tutor زمینه مکالمه را حفظ کند.
- تست واحد واقعی برای `ApiClient` (قرارداد دقیق مسیر/بدنه/هدر Authorization، تبدیل خطاهای
  ۴۰۱/۴۰۰ به `ApiException`) و برای `Session` (ذخیره/حذف نشست، رفتار «به‌خاطرسپردن کد ورود» با
  `SecureStorage` جعلیِ خودمان — نه Mock پلتفرم‌چنل بسته `flutter_secure_storage`، که در تست
  واحد بدون دستگاه واقعی قابل فراخوانی نیست).
- تمدید خودکار accessToken: مثل `mobile-parent`، `ApiClient` روی هر ۴۰۱ یک‌بار خودش
  `POST /auth/refresh` را امتحان می‌کند و پیام چت را با توکن جدید دوباره می‌فرستد — بدون این،
  کودک هر ۱۵ دقیقه (طول عمر accessToken) وسط گفتگو با Tutor به‌اجبار خارج می‌شد.
- Build واقعی APK (Debug) در CI: Job دوم (`build-android` در `.github/workflows/mobile-child-ci.yml`)
  پوشه `android/` را با خود ابزار `flutter create --platforms=android` می‌سازد (نه دستی نوشته
  شده) و سپس `flutter build apk --debug` را واقعاً اجرا می‌کند؛ APK خروجی به‌عنوان Artifact در
  همان اجرای CI قابل دانلود است.
- QR Provisioning برای ورود (`QrScanScreen` + `mobile_scanner`): در `LoginScreen`، دکمه «اسکن
  کد QR» دوربین را باز می‌کند و کد ورودی را که اپ والد نشان می‌دهد می‌خواند، به‌جای تایپ دستی
  UUID. اعتبارسنجی/استخراج محتوای اسکن‌شده در `core/qr_codes.dart` به‌صورت تابع خالص نوشته شده
  (قابل تست واقعی بدون دوربین — `test/qr_codes_test.dart`)؛ کد نامعتبر (مثلاً QR یک سایت دیگر)
  نادیده گرفته می‌شود، نه این‌که صفحه را با خطا ببندد.

## آیتم‌های باز (صادقانه)

1. **Build کامل iOS**: نیازمند Runner مک (`macos-latest`) است که در این پروژه هنوز استفاده نشده —
   همان تصمیم جداگانه و هنوز‌نگرفته‌شده مستندشده در `mobile-parent/README.md`.
2. **پوشه `android/` در ریپو Commit نشده**: عمداً، چون باید توسط خود `flutter create` ساخته شود؛
   CI آن را در هر اجرا تازه می‌سازد. برای اجرای محلی باید یک‌بار
   `flutter create --platforms=android --org com.aifamily .` را خودتان اجرا کنید (جزئیات زیر).
3. **بدون تست خودکار واقعی برای خود دوربین**: چون `mobile_scanner` از Platform Channel واقعی
   استفاده می‌کند، در محیط `flutter test` (بدون دستگاه) قابل اجرا نیست — فقط منطق استخراج/اعتبارسنجی
   (`qr_codes.dart`) تست خودکار دارد؛ خود صفحه اسکن باید دستی روی دستگاه واقعی تایید شود.
4. **بدون تاریخچه گفتگوی ماندگار**: چون بک‌اند مسیر GET برای تاریخچه AI Tutor ندارد، با بستن اپ
   تاریخچه چت از بین می‌رود (فقط context کوتاه‌مدت سمت سرور، نه سمت کلاینت).
5. ~~**پین نسخه Flutter**~~ — حل شد: مهاجرت واقعی به `package:material_ui/material_ui.dart`
   انجام شد (زیر را ببینید)؛ پین ۳.۴۷.۹ همچنان برای پایداری Runner نگه داشته شده، نه به‌خاطر
   منسوخی `flutter/material.dart`.

## آیتم باز شناخته‌شده (پیشین) — مهاجرت `material_ui`: حل شد

نسخه قبلی این بخش می‌گفت این اپ هنوز از `package:flutter/material.dart` منسوخ‌شده استفاده
می‌کند و مهاجرت به `package:material_ui/material_ui.dart` انجام نشده. اکنون همه فایل‌های
`lib/` (`main.dart` و هر چهار صفحه) به `package:material_ui/material_ui.dart` مهاجرت کرده‌اند؛
نام‌های کلاس/ویجت (`MaterialApp`، `Scaffold`، ...) طبق مستندات رسمی مهاجرت بدون تغییر باقی
می‌مانند. این اپ از `flutter_localizations` استفاده نمی‌کرد، پس نیازی به تغییر
`localizationsDelegates` نبود. `material_ui: ^1.4.0` (اولین نسخه‌ای که رسماً حداقل SDK آن
Flutter 3.47 اعلام شده — سازگار با پین فعلی ۳.۴۷.۹) به `pubspec.yaml` اضافه شد.

## اجرا (روی ماشینی با دسترسی اینترنت کامل)

```bash
flutter pub get
flutter create --platforms=android --org com.aifamily .  # فقط یک‌بار، برای ساخت پوشه android/
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
flutter test
flutter build apk --debug
```
