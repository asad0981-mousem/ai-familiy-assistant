# درباره `google-services.json` کنار همین فایل

فایل `google-services.json` این پوشه یک **Placeholder ساختاری-معتبر** است، نه یک پروژه واقعی
Firebase — فقط برای این‌که پلاگین `com.google.gms.google-services` بتواند Build را بدون خطا
انجام دهد (این پلاگین حتی برای ساختن APK، بدون این‌که واقعاً Push کار کند، به وجود فیزیکی این
فایل نیاز دارد). `package_name` داخل آن (`com.aifamily.deviceagent`) درست است، اما بقیه مقادیر
(`project_number`، `api_key`، `mobilesdk_app_id`) ساختگی‌اند و به هیچ پروژه واقعی Firebase وصل
نیستند — یعنی با همین فایل، FCM Push واقعاً به این اپ نمی‌رسد (گزارش توکن به بک‌اند هم موفق
نمی‌شود چون Firebase SDK نمی‌تواند روی این پروژه ساختگی ثبت‌نام کند).

## برای فعال‌سازی واقعی

1. در <https://console.firebase.google.com> یک پروژه بسازید (یا پروژه موجود را انتخاب کنید).
2. یک اپ اندروید جدید با Package Name **دقیقاً** `com.aifamily.deviceagent` اضافه کنید.
3. فایل `google-services.json` واقعی را دانلود و همین فایل Placeholder را با آن جایگزین کنید.
4. در تنظیمات پروژه → Service Accounts → Generate New Private Key، یک Service Account JSON
   دانلود کنید و طبق `backend/.env.example` (کلید `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`) آن را
   Base64 کرده و به محیط بک‌اند (یا GitHub Secret، اگر در CI/CD استفاده می‌کنید) اضافه کنید.

(نکته: برخلاف Service Account JSON که محرمانه است، `google-services.json` واقعی هم معمولاً
Commit می‌شود — شناسه‌های داخلش عمومی‌اند، نه Secret؛ اما همچنان باید از پروژه واقعی خودتان باشد.)
