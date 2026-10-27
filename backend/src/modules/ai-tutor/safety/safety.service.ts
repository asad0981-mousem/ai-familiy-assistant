import { Injectable, Logger } from "@nestjs/common";

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Safety Agent — به‌صورت معماری از Tutor/Memory Agent جدا نگه داشته شده (SEC-040، فصل ۱۳).
 * این سرویس هرگز نباید در همان کلاس/فایل TutorService ادغام شود؛ جداسازی فیزیکی فایل/ماژول
 * پیش‌نیاز بازبینی امنیتی مستقل روی مسیر تصمیم‌گیری ایمنی محتوا برای کودک است.
 *
 * وضعیت پیاده‌سازی فعلی (صادقانه، نه کامل): فقط یک فیلتر کلیدواژه‌ای پایه است — جایگزین کافی
 * برای یک مدل Moderation واقعی (مثلاً OpenAI Moderation API یا مدل اختصاصی) نیست.
 * قبل از ورود به Production، این سرویس باید با یک Provider Moderation واقعی جایگزین/تقویت شود
 * و این TODO در فصل ۴۷ (Final QA Report) سند نهایی به‌عنوان آیتم باز گزارش شده است.
 */
@Injectable()
export class SafetyService {
  private readonly logger = new Logger(SafetyService.name);

  private readonly blockedPatterns: RegExp[] = [
    /\b(self[\s-]?harm|suicide)\b/i,
    // TODO(production-blocker): فهرست فعلی نمونه‌ای و ناکافی است؛ باید با سرویس Moderation واقعی جایگزین شود.
  ];

  checkUserInput(content: string): SafetyCheckResult {
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(content)) {
        this.logger.warn("Safety filter blocked a user message (pattern match)");
        return { allowed: false, reason: "محتوای پیام نیاز به بررسی دارد" };
      }
    }
    return { allowed: true };
  }

  checkAiOutput(content: string): SafetyCheckResult {
    // در نسخه فعلی خروجی AI را عبور می‌دهد؛ جایگاه الزامی برای Moderation خروجی قبل از Production.
    return { allowed: true, reason: content.length > 0 ? undefined : "پاسخ خالی" };
  }
}
