# AI Family Assistant — Monorepo

پیاده‌سازی واقعی پروژه، بر پایه ۱۲ فاز مستندسازی تکمیل‌شده (SRS تا Final Product & Technical Blueprint).

## ساختار

```
backend/         NestJS Modular Monolith — فاز ۴/۵/۲۰ Blueprint
mobile-child/     اپ Flutter کودک — MVP شروع شد، جزئیات در mobile-child/README.md
mobile-parent/    اپ Flutter والد (Flutter) — MVP شروع شد، جزئیات در mobile-parent/README.md
device-agent/     Device Agent اندروید Native (Kotlin) — شروع شده، MVP با Device Owner واقعی (فعال‌سازی ADB)
infra/            Docker Compose و پیکربندی زیرساخت
docs/             مستندات فازهای ۱ تا ۱۲ (SRS تا Final Blueprint)
```

## وضعیت پیاده‌سازی (صادقانه، به‌روز)

از این مرحله به بعد، بک‌اند روی **GitHub Actions CI واقعی** تایید می‌شود (نصب واقعی `npm install`،
Lint، کامپایل TypeScript، `CREATE EXTENSION vector` روی PostgreSQL واقعی، اجرای کامل Migration‌ها،
و تست خودکار Unit+E2E) — نه فقط ادعا یا SQL دستی. وضعیت فعلی workflow: `.github/workflows/backend-ci.yml`.

| بخش | وضعیت |
|---|---|
| CI/CD (GitHub Actions) | ✅ فعال و سبز — نصب، Lint، Build، Migration روی pgvector واقعی، Unit+E2E Tests |
| زیرساخت محلی (Postgres+Redis) | ✅ کار می‌کند؛ pgvector در CI واقعی تایید شده (فقط در Sandbox توسعه این جلسه نصب نشد) |
| بک‌اند — Auth (ثبت‌نام/ورود والد، JWT) | ✅ Migration + تست E2E واقعی تایید شد |
| بک‌اند — Family/User Core | ✅ Migration + تست E2E واقعی تایید شد |
| بک‌اند — AI Tutor (Provider Abstraction + Fallback + Memory ۴‌سطحی + Safety جدا) | ✅ Migration + تست E2E واقعی تایید شد (جداسازی Safety Agent، Fallback واقعی openai→anthropic، Tenant Isolation مکالمه، نشت‌نکردن حافظه بین خانواده‌ها) |
| بک‌اند — Device/Command Matrix (۱۲ نوع دستور، Outbox، امضای Ed25519) | ✅ Migration + تست E2E (Idempotency، قفل WIPE_DATA) واقعی تایید شد |
| بک‌اند — Location (Consent Gate + AES-256-GCM) | ✅ Migration + تست E2E (رد/تایید/لغو Consent، مقدار رمزگشایی‌شده صحیح) واقعی تایید شد |
| بک‌اند — Policy Engine (Optimistic Locking، SYNC_POLICY خودکار) | ✅ Migration + تست E2E (ادغام جزئی Rules، ۴۰۹ روی نسخه نادرست، ابلاغ خودکار لغو Consent) واقعی تایید شد |
| بک‌اند — Child Login (PIN) | ✅ Migration (`pin_hash`) + تست E2E (تنظیم PIN توسط والد، ورود موفق/ناموفق، IDOR، PIN نامعتبر، اعتبار توکن کودک صادرشده) واقعی تایید شد |
| بک‌اند — Refresh Token (`POST /auth/refresh`) | ✅ تست E2E (تمدید والد/کودک، رد توکن نامعتبر/منقضی/با Secret اشتباه، رد توکن دستگاه) واقعی تایید شد |
| تست خودکار Unit/E2E | ✅ ۳۰+ تست سبز در CI (رمزنگاری، امضا، IDOR، Consent Gate، Policy، AI Tutor، Child Login، Refresh Token) |
| Device Agent (اندروید) | 🟡 MVP شروع شد — Outbox Pull Pattern + تایید محلی امضای Ed25519 (غیرمتقارن واقعی، نه HMAC) + Enrollment با اسکن QR (CameraX+ML Kit) یا دستی + قفل/پاک‌سازی واقعی با Device Admin عادی + مسدودسازی اپ/حالت خواب/محدودیت زمان صفحه با Device Owner واقعی (فعال‌سازی فقط از طریق ADB، نه QR/Factory-Reset Provisioning) + CI (`./gradlew test`+`assembleDebug`) واقعی تایید می‌شود؛ رفتار واقعی Device Owner روی دستگاه فیزیکی در CI تایید نشده (جزئیات در `device-agent/README.md`) |
| اپ والد (Flutter) | 🟡 MVP شروع شد — Auth (با تمدید خودکار accessToken)، فرزندان، دستگاه‌ها/دستور (با QR اتصال دستگاه)، Policy (Optimistic Locking واقعی)، Consent/موقعیت مکانی، تنظیم PIN + نمایش QR ورود کودک + مهاجرت‌شده به `package:material_ui/material_ui.dart`؛ `flutter analyze`+`flutter test`+`flutter build apk --debug` واقعی در CI تایید می‌شود (بدون iOS — نیازمند Runner مک؛ جزئیات در `mobile-parent/README.md`) |
| اپ کودک (Flutter) | 🟡 MVP شروع شد — ورود با کد ورود (childId)+PIN واقعی (با تمدید خودکار accessToken + اسکن QR به‌جای تایپ دستی)، گفتگوی چت با AI Tutor، به‌خاطرسپردن کد ورود در دستگاه + مهاجرت‌شده به `package:material_ui/material_ui.dart`؛ `flutter analyze`+`flutter test`+`flutter build apk --debug` واقعی در CI تایید می‌شود (جزئیات در `mobile-child/README.md`) |

### آیتم باز شناخته‌شده (پیشین) — ورود واقعی کودک: حل شد

نسخه قبلی این بخش می‌گفت مسیر ورود کودک (PIN) هنوز پیاده‌سازی نشده و تست‌های AI Tutor مجبورند توکن
کودک را به‌صورت دستی صادر کنند. اکنون `POST /api/v1/auth/child-login` به‌طور کامل پیاده‌سازی و با
E2E واقعی (`backend/test/child-login.e2e-spec.ts`) تایید شده: والد از طریق
`PATCH /api/v1/family-members/children/:childId/pin` یک PIN چهار تا شش‌رقمی (هش argon2id) برای
کودک تنظیم می‌کند، و کودک با همان `childId` + PIN وارد می‌شود و توکن نقش `"child"` واقعی دریافت
می‌کند — دقیقاً با همان قرارداد Payload که AI Tutor/Policies/Locations پیش‌تر انتظار داشتند.

### آیتم باز شناخته‌شده (پیشین) — Ed25519 (امضای غیرمتقارن دستورات): حل شد

نسخه قبلی این بخش می‌گفت امضای دستورات هنوز HMAC-SHA256 با کلید مشترک است (سرور و Device Agent
هر دو همان کلید را نگه می‌داشتند) و مسیر ارتقا به Ed25519 غیرمتقارن اجرا نشده. اکنون
`CommandSignerService` (بک‌اند) با Ed25519 امضا می‌کند و فقط کلید خصوصی را نگه می‌دارد؛ Device
Agent (با کتابخانه Pure Java `net.i2p.crypto:eddsa`، چون پشتیبانی بومی اندروید از Ed25519 فقط از
API 33 به بعد است) فقط کلید عمومی غیرمحرمانه را دارد — Decompile کردن APK دیگر کلید جعل دستور
نمی‌دهد. یک تست مقدار طلایی مشترک (`command-signer.service.spec.ts` ⇄ `CommandSignerTest.kt`)
سازگاری کامل دو پیاده‌سازی را تایید می‌کند. جزئیات کامل در `device-agent/README.md`.

### آیتم باز شناخته‌شده (پیشین) — Enrollment واقعی Device Agent (QR): حل شد

نسخه قبلی این بخش می‌گفت مسیر امن انتقال Device Token از اپ والد به Device Agent هنوز پیاده‌سازی
نشده و فعلاً باید دستی تایپ شود. اکنون `QrScanActivity` (Kotlin، CameraX + ML Kit Barcode
Scanning) همان QR را که اپ والد نمایش می‌دهد اسکن می‌کند؛ پارس محتوای QR در `EnrollmentQr.kt`
(Kotlin خالص، بدون org.json/android.*) پیاده و با تست واحد JVM واقعی (`EnrollmentQrTest.kt`)
تایید شده — جزئیات کامل در `device-agent/README.md`.

## اجرای محلی (روی ماشینی با دسترسی اینترنت کامل)

```bash
cd backend
cp .env.example .env   # مقداردهی اسرار واقعی
npm install
npm run migration:run
npm run start:dev
```

## محدودیت شناخته‌شده: pgvector

افزونه pgvector در Sandbox توسعه این جلسه قابل نصب نبود (دسترسی apt/PGDG مسدود، و دسترسی به headers سرور PostgreSQL برای build از سورس هم موجود نبود). ستون Embedding به‌صورت موقت `float8[]` تعریف شده و Migration ارتقا (`20260101000002-pgvector-upgrade.ts`) برای تبدیل به `vector(1536)` + ایندکس `ivfflat` آماده است — باید روی محیطی با دسترسی کامل بسته‌ها اجرا شود.
