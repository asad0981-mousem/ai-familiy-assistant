import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration — Location + Consent Gate (فصل ۱۰/۱۲ Blueprint نهایی). وابسته به devices/users/families.
 */
export class Locations20260101000004 implements MigrationInterface {
  name = "Locations20260101000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "location_consents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "family_id" uuid NOT NULL,
        "child_id" uuid NOT NULL,
        "granted_by_user_id" uuid NOT NULL,
        "granted_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        CONSTRAINT "PK_location_consents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_location_consents_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_location_consents_child" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_location_consents_family_child" ON "location_consents" ("family_id", "child_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "locations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "family_id" uuid NOT NULL,
        "child_id" uuid NOT NULL,
        "device_id" uuid NOT NULL,
        "lat_encrypted" text NOT NULL,
        "lng_encrypted" text NOT NULL,
        "accuracy_meters" real,
        "captured_at" timestamptz NOT NULL,
        CONSTRAINT "PK_locations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_locations_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_locations_child" FOREIGN KEY ("child_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_locations_device" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_locations_family_child_captured" ON "locations" ("family_id", "child_id", "captured_at")`,
    );

    await queryRunner.query(
      `INSERT INTO "migrations" ("timestamp", "name") VALUES (20260101000004, 'Locations20260101000004')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "locations"`);
    await queryRunner.query(`DROP TABLE "location_consents"`);
  }
}
