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
- ثبت دستگاه (`enrollDevice`) هم به‌صورت متن قابل‌کپی (`deviceToken`) و هم به‌صورت QR
  (`qr_flutter`، با `QrImageView(data: '\${session.api.baseUrl}\n\$deviceToken')`) نمایش می‌دهد؛
  Device Agent (Kotlin native، `QrScanActivity` با CameraX + ML Kit) همین QR را اسکن و هر دو
  فیلد (آدرس سرور + Device Token) را خودکار پر می‌کند — هماهنگ با `device-agent/README.md`.
- تنظیم PIN ورود کودک (`setChildPin` → `PATCH /family-members/children/:childId/pin`) از صفحه
  جزئیات فرزند — PIN وارد شده مستقیماً توسط همان کودک در اپ کودک (`mobile-child`، از طریق
  `POST /auth/child-login`) برای ورود استفاده می‌شود.
- کد ورود اپ کودک (`_showLoginCode` در `ChildDetailScreen`) هم به‌صورت متن قابل‌کپی و هم به‌صورت
  QR (`qr_flutter`، با `QrImageView(data: widget.child.id)`) نمایش داده می‌شود — اپ کودک همین QR
  را با دوربین اسکن می‌کند (`mobile-child/lib/screens/qr_scan_screen.dart`)، به‌جای تایپ دستی
  UUID.
- تمدید خودکار accessToken: چون accessToken کوتاه‌مدت است (پیش‌فرض ۱۵ دقیقه، `jwt.accessExpiresIn`
  سمت بک‌اند)، `ApiClient` روی هر ۴۰۱ یک‌بار خودش `POST /auth/refresh` را امتحان می‌کند و در صورت
  موفقیت، درخواست اصلی را با توکن جدید دوباره می‌فرستد — کاملاً شفاف برای UI، بدون نیاز به ورود
  دوباره هر ۱۵ دقیقه. فقط اگر خود تمدید هم شکست بخورد (۴۰۱)، `Session.logout()` فراخوانی می‌شود.
- Build واقعی APK (Debug) در CI: Job دوم (`build-android` در `.github/workflows/mobile-parent-ci.yml`)
  پوشه `android/` را با خود ابزار `flutter create --platforms=android` می‌سازد (نه دستی نوشته
  شده) و سپس `flutter build apk --debug` را واقعاً اجرا می‌کند؛ APK خروجی به‌عنوان Artifact در
  همان اجرای CI قابل دانلود است.

## آیتم‌های باز (صادقانه)

1. **Build کامل iOS**: نیازمند Runner مک (`macos-latest`) است که در این پروژه هنوز استفاده نشده
   (هزینه/سرعت متفاوت از `ubuntu-latest`) — تصمیمی جداگانه و آگاهانه که هنوز گرفته نشده.
2. **پوشه `android/` در ریپو Commit نشده**: عمداً، چون باید توسط خود `flutter create` ساخته شود؛
   CI آن را در هر اجرا تازه می‌سازد. برای اجرای محلی باید یک‌بار
   `flutter create --platforms=android --org com.aifamily .` را خودتان اجرا کنید (جزئیات زیر).
3. **مهاجرت از `package:flutter/material.dart`**: نسخه‌های جدیدتر Flutter stable (۳.۵۰.۰ به بعد)
   این پکیج را منسوخ اعلام کرده‌اند و `package:material_ui/material_ui.dart` را جایگزین
   پیشنهاد می‌دهند. این CI عمداً روی Flutter ۳.۴۷.۹ پین شده (`.github/workflows/mobile-parent-ci.yml`)
   تا سبز بماند؛ مهاجرت واقعی به API جدید هنوز انجام نشده و باید جداگانه و آگاهانه بررسی شود.

## اجرا (روی ماشینی با دسترسی اینترنت کامل)

```bash
flutter pub get
flutter create --platforms=android --org com.aifamily .  # فقط یک‌بار، برای ساخت پوشه android/
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
flutter test
flutter build apk --debug
```
