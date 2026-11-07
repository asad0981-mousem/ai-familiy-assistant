import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * امضای دستورات Device Agent — طبق فصل ۱۶ (Security Architecture).
 * پیاده‌سازی فعلی: HMAC-SHA256 با کلید مشترک سرور (ساده‌تر برای MVP، بدون وابستگی بسته خارجی).
 * مسیر ارتقا مستندشده: Ed25519 امضای غیرمتقارن به‌ازای هر دستگاه (device_public_key در Entity Device
 * از هم‌اکنون برای همین منظور رزرو شده) — قبل از Production باید جایگزین شود تا سرور به‌تنهایی
 * نتواند جعل دستور کند (Non-repudiation)؛ این یک آیتم باز شناخته‌شده است، نه ادعای کامل بودن.
 *
 * دو اصلاح نسبت به نسخه قبلی:
 * ۱. کلید امضا دیگر jwt.accessSecret نیست (باگ امنیتی واقعی: هر طرفی که این کلید را برای تایید
 *    امضای دستور نگه می‌داشت — مثلاً Device Agent — عملاً کلید جعل توکن JWT سرور را هم داشت).
 *    حالا از commandSigning.secret مجزا استفاده می‌شود که فقط برای همین منظور به Device Agent داده می‌شود.
 * ۲. Canonical JSON حالا به‌صورت بازگشتی روی تمام سطوح کلیدها را مرتب می‌کند، نه فقط سطح اول.
 *    نسخه قبلی (`JSON.stringify(payload, Object.keys(payload).sort())`) فقط ترتیب کلیدهای سطح اول
 *    را کنترل می‌کرد؛ ترتیب کلیدهای داخل payload تودرتو به ترتیب درج وابسته بود که وقتی از ستون
 *    jsonb پایگاه‌داده دوباره خوانده می‌شود (نه مستقیم از شیء زمان امضا) تضمینی برای حفظ ترتیب اصلی
 *    وجود ندارد — این می‌توانست باعث شکست تایید امضا در Device Agent برای دستورات کاملاً معتبر شود.
 */
@Injectable()
export class CommandSignerService {
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret = config.get<string>("commandSigning.secret") as string;
  }

  sign(payload: Record<string, unknown>): string {
    const canonical = canonicalize(payload);
    return createHmac("sha256", this.secret).update(canonical).digest("hex");
  }

  verify(payload: Record<string, unknown>, signature: string): boolean {
    const expected = this.sign(payload);
    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  }
}

/**
 * سریالایز Canonical بازگشتی: در هر سطح، کلیدهای شیء به‌صورت الفبایی مرتب می‌شوند؛ آرایه‌ها
 * ترتیب عنصرهای خود را حفظ می‌کنند (معنادار است) اما هر عنصر هم به‌صورت بازگشتی canonical می‌شود.
 * این دقیقاً همان الگوریتمی است که باید در Device Agent (Kotlin) برای تایید محلی امضا پیاده‌سازی شود.
 */
export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const entries = keys.map(
      (key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`,
    );
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}
