import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration ارتقا — تبدیل ستون موقت ai_memories.embedding (float8[]) به نوع واقعی vector(1536)
 * به‌همراه ایندکس ivfflat برای جستجوی معنایی کارآمد.
 *
 * ⚠️ این Migration عمداً در محیط توسعه فعلی (Sandbox ابری بدون دسترسی apt/PGDG) اجرا نشده است
 * چون افزونه pgvector در آن محیط قابل نصب نیست (مستند در فصل ۱۴ Blueprint نهایی، گزارش محدودیت
 * به کاربر در جلسه پیاده‌سازی). این Migration باید روی محیطی اجرا شود که:
 *   CREATE EXTENSION vector;
 * در آن با موفقیت اجرا می‌شود (معمولاً staging/production با دسترسی کامل بسته‌ها، یا تصویر Docker
 * رسمی pgvector/pgvector که در infra/docker-compose.yml این پروژه هم استفاده شده است).
 *
 * ترتیب اجرا: حتماً پس از InitialSchema20260101000001 و قبل از ورود داده واقعی Embedding.
 */
export class PgvectorUpgrade20260101000002 implements MigrationInterface {
  name = "PgvectorUpgrade20260101000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await queryRunner.query(`
      ALTER TABLE "ai_memories"
      ADD COLUMN "embedding_v" vector(1536)
    `);

    // تبدیل داده موجود (در صورت وجود) از float8[] به vector — placeholder؛
    // در عمل بسته به حجم داده باید batch شود.
    await queryRunner.query(`
      UPDATE "ai_memories"
      SET "embedding_v" = embedding::text::vector
      WHERE "embedding" IS NOT NULL
    `);

    await queryRunner.query(`ALTER TABLE "ai_memories" DROP COLUMN "embedding"`);
    await queryRunner.query(
      `ALTER TABLE "ai_memories" RENAME COLUMN "embedding_v" TO "embedding"`,
    );

    await queryRunner.query(`
      CREATE INDEX "IDX_ai_memories_embedding_ivfflat"
      ON "ai_memories"
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_ai_memories_embedding_ivfflat"`);
    await queryRunner.query(`ALTER TABLE "ai_memories" ALTER COLUMN "embedding" TYPE float8[] USING NULL`);
  }
}
