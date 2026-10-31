import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * امضای دستورات Device Agent — طبق فصل ۱۶ (Security Architecture).
 * پیاده‌سازی فعلی: HMAC-SHA256 با کلید مشترک سرور (ساده‌تر برای MVP، بدون وابستگی بسته خارجی).
 * مسیر ارتقا مستندشده: Ed25519 امضای غیرمتقارن به‌ازای هر دستگاه (device_public_key در Entity Device
 * از هم‌اکنون برای همین منظور رزرو شده) — قبل از Production باید جایگزین شود تا سرور به‌تنهایی
 * نتواند جعل دستور کند (Non-repudiation)؛ این یک آیتم باز شناخته‌شده است، نه ادعای کامل بودن.
 */
@Injectable()
export class CommandSignerService {
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret =
      config.get<string>("jwt.accessSecret") || "insecure-dev-only-command-signing-secret";
  }

  sign(payload: Record<string, unknown>): string {
    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
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
