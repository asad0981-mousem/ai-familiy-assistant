import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../../common/entities/base.entity";
import { Conversation } from "./conversation.entity";

export enum MessageRole {
  USER = "user",
  ASSISTANT = "assistant",
  SYSTEM = "system",
}

/**
 * یک پیام درون مکالمه. طبق سیاست نگهداری فصل ۳۸: مکالمه/خلاصه نامحدود نگه داشته می‌شود
 * اما صدای خام (در صورت وجود ورودی صوتی) پس از پردازش (گذرا) نگهداری نمی‌شود.
 */
@Entity({ name: "ai_messages" })
@Index(["conversationId"])
export class Message extends BaseEntity {
  @Column({ name: "conversation_id" })
  conversationId!: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "conversation_id" })
  conversation!: Conversation;

  @Column({ name: "role", type: "enum", enum: MessageRole })
  role!: MessageRole;

  @Column({ name: "content", type: "text" })
  content!: string;

  @Column({ name: "provider", type: "varchar", length: 40, nullable: true })
  provider?: string | null;

  @Column({ name: "model", type: "varchar", length: 60, nullable: true })
  model?: string | null;
}
