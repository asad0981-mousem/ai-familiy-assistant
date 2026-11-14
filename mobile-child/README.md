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

## آیتم‌های باز (صادقانه)

1. **Build کامل iOS**: نیازمند Runner مک (`macos-latest`) است که در این پروژه هنوز استفاده نشده —
   همان تصمیم جداگانه و هنوز‌نگرفته‌شده مستندشده در `mobile-parent/README.md`.
2. **پوشه `android/` در ریپو Commit نشده**: عمداً، چون باید توسط خود `flutter create` ساخته شود؛
   CI آن را در هر اجرا تازه می‌سازد. برای اجرای محلی باید یک‌بار
   `flutter create --platforms=android --org com.aifamily .` را خودتان اجرا کنید (جزئیات زیر).
3. **بدون QR Provisioning واقعی**: کد ورود (childId، یک UUID) فعلاً باید به‌صورت متن از اپ والد
   کپی و در اپ کودک تایپ شود؛ اسکن QR اضافه نشده.
4. **بدون تاریخچه گفتگوی ماندگار**: چون بک‌اند مسیر GET برای تاریخچه AI Tutor ندارد، با بستن اپ
   تاریخچه چت از بین می‌رود (فقط context کوتاه‌مدت سمت سرور، نه سمت کلاینت).
5. **پین نسخه Flutter**: مطابق `mobile-parent` روی ۳.۴۷.۹ پین شده تا ارتقای خودکار Runner به
   نسخه‌ای با `package:flutter/material.dart` منسوخ (۳.۵۰.۰ به بعد) باعث قرمزشدن ناگهانی نشود.

## اجرا (روی ماشینی با دسترسی اینترنت کامل)

```bash
flutter pub get
flutter create --platforms=android --org com.aifamily .  # فقط یک‌بار، برای ساخت پوشه android/
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
flutter test
flutter build apk --debug
```
