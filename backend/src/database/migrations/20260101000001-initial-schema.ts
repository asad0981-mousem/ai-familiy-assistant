import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration اولیه — هسته Auth/Family/User + AI Tutor (Conversation/Message/Memory).
 * زیرمجموعه‌ای از ۲۳ Entity فصل ۱۷ Blueprint نهایی؛ ماژول‌های بعدی (Device Agent, Location,
 * Command, Policy) هرکدام Migration جداگانه خود را هنگام پیاده‌سازی آن ماژول اضافه می‌کنند.
 */
export class InitialSchema20260101000001 implements MigrationInterface {
  name = "InitialSchema20260101000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TYPE "subscription_tier_enum" AS ENUM ('free', 'premium', 'family')
    `);
    await queryRunner.query(`
      CREATE TABLE "families" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "name" varchar(120) NOT NULL,
        "subscription_tier" "subscription_tier_enum" NOT NULL DEFAULT 'free',
        "timezone" varchar(64) NOT NULL DEFAULT 'Asia/Tehran',
        "locale" varchar(10) NOT NULL DEFAULT 'fa-IR',
        CONSTRAINT "PK_families" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE TYPE "user_role_enum" AS ENUM ('parent', 'child')`);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "family_id" uuid NOT NULL,
        "display_name" varchar(80) NOT NULL,
        "email" varchar(255) UNIQUE,
        "password_hash" varchar(255),
        "role" "user_role_enum" NOT NULL,
        "age_band" varchar(10),
        "is_active" boolean NOT NULL DEFAULT true,
        "last_login_at" timestamptz,
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "FK_users_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_users_family_role" ON "users" ("family_id", "role")`);

    await queryRunner.query(`
      CREATE TABLE "ai_conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "family_id" uuid NOT NULL,
        "child_id" uuid NOT NULL,
        "topic" varchar(120),
        "started_at" timestamptz NOT NULL,
        "ended_at" timestamptz,
        CONSTRAINT "PK_ai_conversations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_conversations_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ai_conversations_child" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_conversations_family_child" ON "ai_conversations" ("family_id", "child_id")`,
    );

    await queryRunner.query(`CREATE TYPE "message_role_enum" AS ENUM ('user', 'assistant', 'system')`);
    await queryRunner.query(`
      CREATE TABLE "ai_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "conversation_id" uuid NOT NULL,
        "role" "message_role_enum" NOT NULL,
        "content" text NOT NULL,
        "provider" varchar(40),
        "model" varchar(60),
        CONSTRAINT "PK_ai_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_messages_conversation" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_ai_messages_conversation" ON "ai_messages" ("conversation_id")`);

    await queryRunner.query(
      `CREATE TYPE "memory_level_enum" AS ENUM ('skill_progress', 'learner_profile', 'family_context')`,
    );
    await queryRunner.query(`
      CREATE TABLE "ai_memories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "family_id" uuid NOT NULL,
        "child_id" uuid,
        "level" "memory_level_enum" NOT NULL,
        "key" varchar(120) NOT NULL,
        "value" jsonb NOT NULL,
        "embedding" float8[],
        "expires_at" timestamptz,
        CONSTRAINT "PK_ai_memories" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_memories_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ai_memories_child" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_memories_family_child_level" ON "ai_memories" ("family_id", "child_id", "level")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ai_memories"`);
    await queryRunner.query(`DROP TYPE "memory_level_enum"`);
    await queryRunner.query(`DROP TABLE "ai_messages"`);
    await queryRunner.query(`DROP TYPE "message_role_enum"`);
    await queryRunner.query(`DROP TABLE "ai_conversations"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "user_role_enum"`);
    await queryRunner.query(`DROP TABLE "families"`);
    await queryRunner.query(`DROP TYPE "subscription_tier_enum"`);
  }
}
