# اپ والد (Flutter)

نسخه MVP — ثبت‌نام/ورود، مدیریت فرزندان، ثبت دستگاه و ارسال دستور، ویرایش Policy
(با Optimistic Locking واقعی)، و مدیریت Consent/مشاهده موقعیت مکانی.

## چه چیزی واقعاً کار می‌کند

- `ApiClient` دقیقاً مطابق قرارداد مسیرهای بک‌اند (`auth`, `family-members`, `devices`,
  `policies`, `locations`) — هیچ Endpoint فرضی/حدسی در این کلاس نیست؛ همه مستقیماً از خواندن
  کنترلرهای واقعی `backend/src/modules/*/*.controller.ts` استخراج شده‌اند.
- نشست (`Session`) با `flutter_secure_storage` ماندگار می‌ماند (بین اجراهای اپ حفظ می‌شود).
- ویرایشگر Policy از `expectedVersion` واقعی استفاده می‌کند و ۴۰۹ (تعارض نسخه) را جدا از خطاهای
  دیگر به کاربر نشان می‌دهد — نه یک پیام خطای عمومی.
- ثبت دستگاه (`enrollDevice`) دقیقاً همان `deviceToken`ای را نمایش می‌دهد که باید دستی در اپ
  Device Agent وارد شود (هماهنگ با `device-agent/README.md` — تا QR Provisioning پیاده‌سازی شود).
- تنظیم PIN ورود کودک (`setChildPin` → `PATCH /family-members/children/:childId/pin`) از صفحه
  جزئیات فرزند — PIN وارد شده مستقیماً توسط همان کودک در اپ کودک (`mobile-child`، از طریق
  `POST /auth/child-login`) برای ورود استفاده می‌شود.
- تمدید خودکار accessToken: چون accessToken کوتاه‌مدت است (پیش‌فرض ۱۵ دقیقه، `jwt.accessExpiresIn`
  سمت بک‌اند)، `ApiClient` روی هر ۴۰۱ یک‌بار خودش `POST /auth/refresh` را امتحان می‌کند و در صورت
  موفقیت، درخواست اصلی را با توکن جدید دوباره می‌فرستد — کاملاً شفاف برای UI، بدون نیاز به ورود
  دوباره هر ۱۵ دقیقه. فقط اگر خود تمدید هم شکست بخورد (۴۰۱)، `Session.logout()` فراخوانی می‌شود.

## آیتم‌های باز (صادقانه)

1. **Build کامل اندروید/iOS**: این نسخه فقط با `flutter analyze` + `flutter test` در CI تایید
   می‌شود، نه `flutter build apk` — چون Scaffold پلتفرم (`android/`, `ios/`) باید توسط خود
   ابزار `flutter create` تولید شود، نه دستی نوشته شود (برخلاف Device Agent که یک پروژه Gradle
   خالص Kotlin بود و دستی قابل‌نوشتن بود).
2. **QR Provisioning**: کد اتصال دستگاه فعلاً به‌صورت متن قابل‌کپی نمایش داده می‌شود (هماهنگ با
   آیتم باز مشابه در Device Agent).
3. **مهاجرت از `package:flutter/material.dart`**: نسخه‌های جدیدتر Flutter stable (۳.۵۰.۰ به بعد)
   این پکیج را منسوخ اعلام کرده‌اند و `package:material_ui/material_ui.dart` را جایگزین
   پیشنهاد می‌دهند. این CI عمداً روی Flutter ۳.۴۷.۹ پین شده (`.github/workflows/mobile-parent-ci.yml`)
   تا سبز بماند؛ مهاجرت واقعی به API جدید هنوز انجام نشده و باید جداگانه و آگاهانه بررسی شود.

## اجرا (روی ماشینی با دسترسی اینترنت کامل)

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
flutter test
```
