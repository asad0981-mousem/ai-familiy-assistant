import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Exclude } from "class-transformer";
import { BaseEntity } from "../../../common/entities/base.entity";
import { Family } from "../../family/entities/family.entity";

export enum UserRole {
  PARENT = "parent",
  CHILD = "child",
}

/**
 * Entity کاربر — هم والد و هم کودک از یک جدول با role تفکیک می‌شوند (طبق فصل ۱۷، ۲۳ Entity نهایی).
 * نکات امنیتی حیاتی (فصل ۱۵):
 * - passwordHash هرگز در پاسخ API سریالایز نمی‌شود (@Exclude).
 * - کودکان زیر سن مشخص Email/Password اختیاری دارند؛ ورود کودک از طریق PIN/QR مرتبط با Device Agent (فاز ۳).
 * - ageBand به‌جای تاریخ تولد دقیق ذخیره می‌شود در مسیرهای غیرضروری، طبق اصل Data Minimization (فصل ۱۶).
 */
@Entity({ name: "users" })
@Index(["family", "role"])
export class User extends BaseEntity {
  @ManyToOne(() => Family, (family) => family.members, { onDelete: "CASCADE" })
  @JoinColumn({ name: "family_id" })
  family!: Family;

  @Column({ name: "family_id" })
  familyId!: string;

  @Column({ name: "display_name", type: "varchar", length: 80 })
  displayName!: string;

  @Column({ name: "email", type: "varchar", length: 255, unique: true, nullable: true })
  email?: string | null;

  @Exclude()
  @Column({ name: "password_hash", type: "varchar", length: 255, nullable: true })
  passwordHash?: string | null;

  /**
   * فقط برای role=child استفاده می‌شود — ورود کودک از طریق PIN (۴ تا ۶ رقمی)، نه ایمیل/رمز عبور.
   * والد آن را برای فرزند تنظیم/بازنشانی می‌کند (PATCH /family-members/children/:childId/pin).
   */
  @Exclude()
  @Column({ name: "pin_hash", type: "varchar", length: 255, nullable: true })
  pinHash?: string | null;

  @Column({ name: "role", type: "enum", enum: UserRole })
  role!: UserRole;

  @Column({ name: "age_band", type: "varchar", length: 10, nullable: true })
  ageBand?: string | null; // مثلا "7-9", "10-12" — طبق Data Minimization؛ نه تاریخ تولد دقیق در مسیرهای عمومی

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "last_login_at", type: "timestamptz", nullable: true })
  lastLoginAt?: Date | null;
}
