import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../../common/entities/base.entity";

/**
 * ۴ سطح AI Memory — طبق فصل ۱۴ Blueprint نهایی (حل تناقض #۳: گسترش از ۳ سطح فاز ۲/۵ به ۴ سطح):
 *
 * SESSION        سطح ۱ — فقط طول یک نشست؛ هرگز پایدار نمی‌شود، در Redis نگه داشته می‌شود نه اینجا.
 * SKILL_PROGRESS سطح ۲ — پیشرفت مهارت/موضوع کودک؛ مبنای تطبیق سطح تمرین.
 * LEARNER_PROFILE سطح ۳ — پروفایل بلندمدت یادگیرنده (نقاط قوت/ضعف، سبک یادگیری).
 * FAMILY_CONTEXT سطح ۴ — زمینه خانواده/والد (اهداف تعیین‌شده توسط والد) — هرگز شامل محتوای خصوصی مکالمه کودک با AI نیست.
 *
 * قانون غیرقابل‌مذاکره (Memory Isolation BLOCKER — TC-AI-020 فاز ۱۰): هیچ ردیف این جدول
 * نباید بین دو family_id متفاوت به اشتراک گذاشته شود؛ هر Query باید family_id را فیلتر کند.
 */
export enum MemoryLevel {
  SKILL_PROGRESS = "skill_progress",
  LEARNER_PROFILE = "learner_profile",
  FAMILY_CONTEXT = "family_context",
}

@Entity({ name: "ai_memories" })
@Index(["familyId", "childId", "level"])
export class AiMemory extends BaseEntity {
  @Column({ name: "family_id", type: "uuid" })
  familyId!: string;

  /**
   * نوع ستون عمداً صریح (type: "uuid") نوشته شده — بدون آن، TypeORM/reflect-metadata نوع
   * یونیون "string | null" را به‌جای String به‌صورت Object تشخیص می‌دهد و Migration با
   * DataTypeNotSupportedError شکست می‌خورد (این باگ واقعی در اولین اجرای CI پیدا و رفع شد).
   */
  @Column({ name: "child_id", type: "uuid", nullable: true })
  childId?: string | null; // null مجاز فقط برای FAMILY_CONTEXT

  @Column({ name: "level", type: "enum", enum: MemoryLevel })
  level!: MemoryLevel;

  @Column({ name: "key", type: "varchar", length: 120 })
  key!: string; // مثلا "vocabulary.animals.mastery" یا "parent_goal.daily_minutes"

  @Column({ name: "value", type: "jsonb" })
  value!: Record<string, unknown>;

  /**
   * بردار Embedding برای جستجوی معنایی (Semantic Retrieval).
   * محدودیت محیط توسعه فعلی: افزونه pgvector در این Sandbox قابل نصب نیست (دسترسی apt/PGDG مسدود).
   * به‌صورت موقت float8[] استفاده شده؛ Migration 20260101000002 مسیر ارتقا به ستون vector(1536)
   * + ایندکس ivfflat را مستند می‌کند و باید روی محیطی با دسترسی کامل اجرا شود.
   */
  @Column({ name: "embedding", type: "float8", array: true, nullable: true })
  embedding?: number[] | null;

  @Column({ name: "expires_at", type: "timestamptz", nullable: true })
  expiresAt?: Date | null;
}
