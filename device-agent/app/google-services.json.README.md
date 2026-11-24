# درباره `google-services.json` کنار همین فایل

این فایل اکنون **واقعی** است — متعلق به پروژه واقعی Firebase با نام `ai-family-assistant`
(`project_id: ai-family-assistant-a9ad8`)، با اپ اندرویدی که Package Name آن دقیقاً
`com.aifamily.deviceagent` است (مطابق applicationId این ماژول). قبلاً اینجا یک Placeholder
ساختاری-معتبر بود (برای این‌که پلاگین `com.google.gms.google-services` بدون خطا Build کند) که
جایگزین شده است.

این فایل محرمانه نیست (شناسه‌های داخل آن — `api_key`، `project_number`، `mobilesdk_app_id` —
عمومی‌اند، نه Secret) و طبیعتاً Commit می‌شود، درست مثل بقیه پروژه‌های Firebase.

## باقی‌مانده برای کامل‌شدن اتصال

برای این‌که ارسال واقعی FCM Push از سمت بک‌اند هم کار کند، هنوز یک مقدار **محرمانه** جداگانه لازم
است که در این فایل نیست: Service Account Private Key پروژه (کنسول Firebase → Project Settings →
Service Accounts → Generate New Private Key)، Base64-شده، به‌عنوان متغیر محیطی
`FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` در محیط واقعی بک‌اند (طبق `backend/.env.example`) —
هرگز در Git Commit نمی‌شود.
