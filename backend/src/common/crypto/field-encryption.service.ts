import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // طول استاندارد IV برای GCM

/**
 * رمزنگاری سطح فیلد — AES-256-GCM — طبق فصل ۱۲ (Location Architecture) و فصل ۱۶ (Security).
 * برای داده‌های حساس (مختصات موقعیت مکانی) که حتی در صورت دسترسی مستقیم به دیتابیس
 * (دامپ/بکاپ افشاشده) نباید قابل‌خواندن باشند.
 *
 * فرمت ذخیره‌شده: base64(iv) + ":" + base64(authTag) + ":" + base64(ciphertext)
 */
@Injectable()
export class FieldEncryptionService implements OnModuleInit {
  private key!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const raw = this.config.get<string>("location.encryptionKey") || "";
    if (!raw || raw.startsWith("CHANGE_ME")) {
      // Fallback ناامن فقط برای توسعه محلی — هرگز در production قابل‌قبول نیست.
      // TODO(production-blocker): بوت باید در صورت نبود LOCATION_ENCRYPTION_KEY واقعی در production شکست بخورد؛
      // این بررسی هنوز اینجا اضافه نشده (آیتم باز، مستند در فصل ۴۷ Final QA Report).
      this.key = Buffer.alloc(32, "dev-only-insecure-key-do-not-use-in-prod");
      return;
    }
    const decoded = Buffer.from(raw, "base64");
    this.key = decoded.length === 32 ? decoded : Buffer.alloc(32, decoded);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(
      ":",
    );
  }

  decrypt(stored: string): string {
    const [ivB64, tagB64, dataB64] = stored.split(":");
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  }
}
