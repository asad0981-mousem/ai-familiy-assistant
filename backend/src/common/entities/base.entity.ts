import {
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * ستون‌های مشترک تمام Entity ها — مطابق الگوی فصل ۱۷ (هر Entity دارای id/created/updated/deleted).
 * Soft Delete (deletedAt) برای رعایت سیاست‌های نگهداری داده (فصل ۳۸) و Audit (فصل ۱۵) الزامی است؛
 * حذف فیزیکی مستقیم ردیف‌های حساس (خانواده/کاربر/مکالمه) ممنوع است مگر طبق فرآیند مستند حذف حساب.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @DeleteDateColumn({ name: "deleted_at", type: "timestamptz", nullable: true })
  deletedAt?: Date | null;
}
