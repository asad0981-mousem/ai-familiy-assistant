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

## آیتم‌های باز (صادقانه)

1. **Build کامل اندروید/iOS**: این نسخه فقط با `flutter analyze` + `flutter test` در CI تایید
   می‌شود، نه `flutter build apk` — چون Scaffold پلتفرم (`android/`, `ios/`) باید توسط خود
   ابزار `flutter create` تولید شود، نه دستی نوشته شود (برخلاف Device Agent که یک پروژه Gradle
   خالص Kotlin بود و دستی قابل‌نوشتن بود).
2. **Refresh Token خودکار**: فعلاً روی ۴۰۱ فقط کاربر را Logout می‌کند؛ تمدید خودکار توکن با
   Refresh Token هنوز اضافه نشده.
3. **QR Provisioning**: کد اتصال دستگاه فعلاً به‌صورت متن قابل‌کپی نمایش داده می‌شود (هماهنگ با
   آیتم باز مشابه در Device Agent).

## اجرا (روی ماشینی با دسترسی اینترنت کامل)

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
flutter test
```
