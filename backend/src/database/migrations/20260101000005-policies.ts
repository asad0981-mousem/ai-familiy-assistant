import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration — Policy Engine (فصل ۹/۱۱ Blueprint نهایی، Parent Control Policy Engine).
 * وابسته به families/users/devices — باید بعد از آن‌ها اجرا شود.
 */
export class Policies20260101000005 implements MigrationInterface {
  name = "Policies20260101000005";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "policies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "family_id" uuid NOT NULL,
        "child_id" uuid NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "updated_by_user_id" uuid NOT NULL,
        "rules" jsonb NOT NULL,
        "signature" text NOT NULL,
        CONSTRAINT "PK_policies" PRIMARY KEY ("id"),
        CONSTRAINT "FK_policies_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_policies_child" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_policies_family_child" ON "policies" ("family_id", "child_id")`,
    );

    await queryRunner.query(
      `INSERT INTO "migrations" ("timestamp", "name") VALUES (20260101000005, 'Policies20260101000005')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "policies"`);
  }
}
