import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createPrivateKey, createPublicKey, sign as edSign, verify as edVerify, KeyObject } from "crypto";

/**
 * امضای دستورات Device Agent — طبق فصل ۱۶ (Security Architecture).
 * پیاده‌سازی فعلی: Ed25519 (امضای غیرمتقارن واقعی)، نه دیگر HMAC-SHA256 با کلید مشترک.
 *
 * چرا این ارتقا لازم بود (آیتم باز قبلی که این فایل خودش مستند کرده بود): با HMAC، همان کلیدی که
 * سرور برای امضا استفاده می‌کرد باید روی Device Agent هم برای تایید موجود باشد — یعنی هر Device
 * Agent (یا هرکس که APK را Decompile کند) به کلید امضا هم دسترسی داشت و عملاً می‌توانست دستور
 * جعل کند (نبود Non-repudiation). با Ed25519: سرور فقط کلید خصوصی را نگه می‌دارد
 * (COMMAND_SIGNING_PRIVATE_KEY_HEX، هرگز خارج از بک‌اند نمی‌رود)، و Device Agent فقط کلید عمومی
 * متناظر را دارد (Device Agent کتابخانه net.i2p.crypto:eddsa را برای تایید استفاده می‌کند — جزئیات
 * در device-agent/app/.../security/CommandSigner.kt) — استخراج APK دیگر امکان جعل دستور نمی‌دهد.
 *
 * کلید خصوصی به‌صورت Seed خام ۳۲ بایتی (۶۴ کاراکتر Hex) پیکربندی می‌شود، سپس با پیشوند ثابت PKCS8
 * (طبق RFC 8410، OID 1.3.101.112) به یک KeyObject واقعی Ed25519 تبدیل می‌شود — بدون وابستگی به
 * بسته npm خارجی، چون Node.js از نسخه ۱۲ به بعد Ed25519 را در ماژول crypto خودش پشتیبانی می‌کند.
 *
 * Canonical JSON به‌صورت بازگشتی روی تمام سطوح کلیدها را مرتب می‌کند، نه فقط سطح اول — چون ترتیب
 * کلیدهای داخل payload تودرتو وقتی از ستون jsonb پایگاه‌داده دوباره خوانده می‌شود (نه مستقیم از شیء
 * زمان امضا) تضمینی برای حفظ ترتیب اصلی ندارد.
 */
const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

@Injectable()
export class CommandSignerService {
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;

  constructor(config: ConfigService) {
    const seedHex = config.get<string>("commandSigning.privateKeyHex") as string;
    this.privateKey = privateKeyFromSeedHex(seedHex);
    this.publicKey = createPublicKey(this.privateKey);
  }

  sign(payload: Record<string, unknown>): string {
    const canonical = canonicalize(payload);
    return edSign(null, Buffer.from(canonical, "utf8"), this.privateKey).toString("hex");
  }

  verify(payload: Record<string, unknown>, signature: string): boolean {
    try {
      const sigBuf = Buffer.from(signature, "hex");
      if (sigBuf.length !== 64) return false; // طول دقیق امضای Ed25519 — رد سریع ورودی جعلی/کوتاه
      const canonical = canonicalize(payload);
      return edVerify(null, Buffer.from(canonical, "utf8"), this.publicKey, sigBuf);
    } catch {
      return false; // امضای بدشکل/نامعتبر — بدون پرتاب خطا به فراخوان
    }
  }

  /**
   * کلید عمومی Hex (۳۲ بایت خام) برای توزیع به Device Agent (به‌صورت Gradle Property
   * COMMAND_SIGNING_PUBLIC_KEY_HEX هنگام Build) — این مقدار محرمانه نیست؛ هرگز کلید خصوصی را
   * برنمی‌گرداند.
   */
  get publicKeyHex(): string {
    const jwk = this.publicKey.export({ format: "jwk" }) as { x: string };
    return Buffer.from(jwk.x, "base64url").toString("hex");
  }
}

function privateKeyFromSeedHex(seedHex: string): KeyObject {
  if (!/^[0-9a-fA-F]{64}$/.test(seedHex)) {
    throw new Error(
      "COMMAND_SIGNING_PRIVATE_KEY_HEX باید دقیقاً ۶۴ کاراکتر Hex (۳۲ بایت Seed خام Ed25519) باشد",
    );
  }
  const der = Buffer.concat([PKCS8_ED25519_PREFIX, Buffer.from(seedHex, "hex")]);
  return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
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
