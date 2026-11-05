# AI Family Assistant — Monorepo

پیاده‌سازی واقعی پروژه، بر پایه ۱۲ فاز مستندسازی تکمیل‌شده (SRS تا Final Product & Technical Blueprint).

## ساختار

```
backend/         NestJS Modular Monolith — فاز ۴/۵/۲۰ Blueprint
mobile-child/     اپ Flutter کودک (برنامه‌ریزی‌شده — هنوز شروع نشده)
mobile-parent/    اپ Flutter والد (برنامه‌ریزی‌شده — هنوز شروع نشده)
device-agent/     Device Agent اندروید Native (برنامه‌ریزی‌شده — هنوز شروع نشده)
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
| بک‌اند — AI Tutor (Provider Abstraction + Fallback + Memory ۴‌سطحی + Safety جدا) | ✅ کامپایل و Migration تایید شد؛ تست E2E اختصاصی هنوز نوشته نشده (آیتم باز) |
| بک‌اند — Device/Command Matrix (۱۲ نوع دستور، Outbox، امضای HMAC) | ✅ Migration + تست E2E (Idempotency، قفل WIPE_DATA) واقعی تایید شد |
| بک‌اند — Location (Consent Gate + AES-256-GCM) | ✅ Migration + تست E2E (رد/تایید/لغو Consent، مقدار رمزگشایی‌شده صحیح) واقعی تایید شد |
| بک‌اند — Policy Engine (Optimistic Locking، SYNC_POLICY خودکار) | ✅ Migration + تست E2E (ادغام جزئی Rules، ۴۰۹ روی نسخه نادرست، ابلاغ خودکار لغو Consent) واقعی تایید شد |
| تست خودکار Unit/E2E | ✅ ۱۴+ تست سبز در CI (رمزنگاری، امضا، IDOR، Consent Gate، Policy) |
| Device Agent (اندروید) | ❌ شروع نشده |
| اپ‌های Flutter | ❌ شروع نشده |

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
