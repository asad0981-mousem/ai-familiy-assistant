import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration — Device و Command Matrix (فصل ۸/۹/۳۷ Blueprint نهایی).
 * وابسته به Migration اولیه (families, users) — باید بعد از آن اجرا شود.
 */
export class DevicesAndCommands20260101000003 implements MigrationInterface {
  name = "DevicesAndCommands20260101000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "device_platform_enum" AS ENUM ('android')`);
    await queryRunner.query(
      `CREATE TYPE "device_management_mode_enum" AS ENUM ('standard', 'device_owner')`,
    );
    await queryRunner.query(
      `CREATE TYPE "device_status_enum" AS ENUM ('pending_enrollment', 'active', 'offline', 'revoked')`,
    );
    await queryRunner.query(`
      CREATE TABLE "devices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "family_id" uuid NOT NULL,
        "child_id" uuid NOT NULL,
        "platform" "device_platform_enum" NOT NULL DEFAULT 'android',
        "management_mode" "device_management_mode_enum" NOT NULL DEFAULT 'standard',
        "status" "device_status_enum" NOT NULL DEFAULT 'pending_enrollment',
        "model" varchar(120),
        "os_version" varchar(40),
        "agent_version" varchar(40),
        "device_public_key" text,
        "enrollment_secret_hash" varchar(255),
        "last_seen_at" timestamptz,
        CONSTRAINT "PK_devices" PRIMARY KEY ("id"),
        CONSTRAINT "FK_devices_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_devices_child" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_devices_family_child" ON "devices" ("family_id", "child_id")`);

    await queryRunner.query(`
      CREATE TYPE "command_type_enum" AS ENUM (
        'lock_device', 'unlock_device', 'set_screen_time_limit', 'block_app', 'unblock_app',
        'force_location_update', 'sleep_mode_enable', 'sleep_mode_disable', 'sync_policy',
        'send_parent_message', 'remote_alarm', 'wipe_data'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "command_status_enum" AS ENUM (
        'created', 'queued', 'sent', 'received', 'executing', 'executed', 'failed', 'expired', 'cancelled'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "device_commands" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "family_id" uuid NOT NULL,
        "device_id" uuid NOT NULL,
        "issued_by_user_id" uuid NOT NULL,
        "type" "command_type_enum" NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}',
        "status" "command_status_enum" NOT NULL DEFAULT 'created',
        "idempotency_key" uuid NOT NULL,
        "signature" text NOT NULL,
        "queued_at" timestamptz,
        "sent_at" timestamptz,
        "received_at" timestamptz,
        "executed_at" timestamptz,
        "failure_reason" text,
        "expires_at" timestamptz NOT NULL,
        CONSTRAINT "PK_device_commands" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_device_commands_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "FK_device_commands_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_device_commands_device" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_device_commands_device_status" ON "device_commands" ("device_id", "status")`,
    );

    await queryRunner.query(
      `INSERT INTO "migrations" ("timestamp", "name") VALUES (20260101000003, 'DevicesAndCommands20260101000003')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "device_commands"`);
    await queryRunner.query(`DROP TYPE "command_status_enum"`);
    await queryRunner.query(`DROP TYPE "command_type_enum"`);
    await queryRunner.query(`DROP TABLE "devices"`);
    await queryRunner.query(`DROP TYPE "device_status_enum"`);
    await queryRunner.query(`DROP TYPE "device_management_mode_enum"`);
    await queryRunner.query(`DROP TYPE "device_platform_enum"`);
  }
}
