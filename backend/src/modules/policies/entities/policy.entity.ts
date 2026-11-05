import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../../common/entities/base.entity";

/**
 * سند سیاست کنترل والدین برای یک کودک — طبق فصل ۹/۱۱ (Parent Control Policy Engine).
 * هر کودک حداکثر یک رکورد Policy فعال دارد (آخرین نسخه). تاریخچه نسخه‌های قبلی نگه داشته نمی‌شود
 * در این نسخه MVP (آیتم باز برای Audit Trail کامل‌تر در آینده).
 *
 * Optimistic Locking: version با هر تغییر افزایش می‌یابد. اگر دو والد هم‌زمان ویرایش کنند،
 * دومی باید نسخه فعلی را دوباره بخواند (خطای 409) — جلوگیری از رونویسی خاموش تغییرات یکدیگر.
 *
 * امضا (signature) دقیقاً مثل DeviceCommand با CommandSignerService تولید می‌شود تا Device Agent
 * بتواند صحت/منشاء Policy دریافتی را قبل از اعمال محلی تایید کند.
 */
@Entity({ name: "policies" })
@Index(["familyId", "childId"], { unique: true })
export class Policy extends BaseEntity {
  @Column({ name: "family_id", type: "uuid" })
  familyId!: string;

  @Column({ name: "child_id", type: "uuid" })
  childId!: string;

  @Column({ name: "version", type: "integer", default: 1 })
  version!: number;

  @Column({ name: "updated_by_user_id", type: "uuid" })
  updatedByUserId!: string;

  /**
   * قوانین Policy — ساختار باز (jsonb) تا بدون Migration جدید بتوان فیلد اضافه کرد.
   * فیلدهای شناخته‌شده فعلی: screenTimeMinutesPerDay, blockedApps (string[]),
   * sleepSchedule ({ start, end } به‌صورت "HH:mm")، locationConsentEnabled (boolean،
   * هم‌گام با LocationConsent — منبع حقیقت LocationConsent است، این فقط کپی برای Device Agent است).
   */
  @Column({ name: "rules", type: "jsonb" })
  rules!: Record<string, unknown>;

  @Column({ name: "signature", type: "text" })
  signature!: string;
}
