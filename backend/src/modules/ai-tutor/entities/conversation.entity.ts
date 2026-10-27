import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import { BaseEntity } from "../../../common/entities/base.entity";
import { User } from "../../users/entities/user.entity";
import { Family } from "../../family/entities/family.entity";
import { Message } from "./message.entity";

/**
 * یک نشست مکالمه بین کودک و AI Tutor — طبق فصل ۱۳/۱۴ Blueprint نهایی.
 * family_id تکراری (denormalized) عمداً نگه داشته شده برای اعمال سریع Tenant Isolation
 * بدون JOIN اضافی در هر Query حساس (الگوی تثبیت‌شده فصل ۱۷).
 */
@Entity({ name: "ai_conversations" })
@Index(["familyId", "childId"])
export class Conversation extends BaseEntity {
  @Column({ name: "family_id" })
  familyId!: string;

  @ManyToOne(() => Family, { onDelete: "CASCADE" })
  @JoinColumn({ name: "family_id" })
  family!: Family;

  @Column({ name: "child_id" })
  childId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "child_id" })
  child!: User;

  @Column({ name: "topic", type: "varchar", length: 120, nullable: true })
  topic?: string | null;

  @Column({ name: "started_at", type: "timestamptz" })
  startedAt!: Date;

  @Column({ name: "ended_at", type: "timestamptz", nullable: true })
  endedAt?: Date | null;

  @OneToMany(() => Message, (message) => message.conversation)
  messages!: Message[];
}
