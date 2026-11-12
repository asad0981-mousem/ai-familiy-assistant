import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration — افزودن ستون pin_hash به users برای ورود کودک (PIN، ۴ تا ۶ رقمی، آرگون۲ هش‌شده).
 * بستن آیتم باز مستندشده در auth.service.ts: «ورود کودک از مسیر جداگانه (PIN/QR) است».
 */
export class UserPin20260101000006 implements MigrationInterface {
  name = "UserPin20260101000006";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "pin_hash" varchar(255)`);

    await queryRunner.query(
      `INSERT INTO "migrations" ("timestamp", "name") VALUES (20260101000006, 'UserPin20260101000006')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "pin_hash"`);
  }
}
