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

| بخش | وضعیت |
|---|---|
| زیرساخت محلی (Postgres+Redis) | ✅ کار می‌کند (بدون pgvector — محدودیت محیط توسعه، نگاه کنید به backend/src/database/migrations) |
| بک‌اند — Auth (ثبت‌نام/ورود والد، JWT) | ✅ کد کامل نوشته شده؛ Migration روی DB واقعی اجرا و تست شد |
| بک‌اند — Family/User Core | ✅ کد کامل؛ Schema تست‌شده با Insert واقعی |
| بک‌اند — AI Tutor (Provider Abstraction + Fallback + Memory ۴‌سطحی + Safety جدا) | ✅ کد کامل نوشته شده؛ **اجرای end-to-end تست نشده** (نیازمند `npm install` که در Sandbox فعلی به‌دلیل مسدودبودن npm registry ممکن نیست) |
| بک‌اند — Device/Command Matrix (۱۲ نوع دستور، Outbox، امضای HMAC) | ✅ کد کامل؛ Schema+Idempotency Constraint با Insert واقعی تست شد |
| بک‌اند — Location (Consent Gate + AES-256-GCM) | ✅ کد کامل؛ منطق رمزنگاری/Tamper-detection با Node.js خالص تست شد؛ Schema+FK با Insert واقعی تست شد |
| Device Agent (اندروید) | ❌ شروع نشده |
| اپ‌های Flutter | ❌ شروع نشده |
| CI/CD | ❌ شروع نشده |
| Policy Engine (سیگنال لغو Consent به Device Agent) | ❌ آیتم باز — شناسایی‌شده در ماژول Location |

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
