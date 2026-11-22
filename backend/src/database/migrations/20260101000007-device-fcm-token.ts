import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration — افزودن ستون fcm_token به devices برای ابلاغ Real-Time (FCM Push)، مکمل Outbox Pull
 * Pattern موجود (CommandPollWorker هر ۱۵ دقیقه). این مقدار را فقط خود Device Agent، بعد از دریافت
 * واقعی توکن از FirebaseMessaging.getInstance().token یا onNewToken، گزارش می‌دهد — نه والد.
 */
export class DeviceFcmToken20260101000007 implements MigrationInterface {
  name = "DeviceFcmToken20260101000007";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "devices" ADD COLUMN "fcm_token" varchar(255)`);

    await queryRunner.query(
      `INSERT INTO "migrations" ("timestamp", "name") VALUES (20260101000007, 'DeviceFcmToken20260101000007')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "devices" DROP COLUMN "fcm_token"`);
  }
}
