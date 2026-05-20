import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN CREATE TYPE "public"."enum_papers_paper_type" AS ENUM('empirical-study', 'literature-review', 'mathematical-model', 'industry-report', 'framework', 'case-study', 'reference'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "avatar_url" varchar;
  ALTER TABLE "papers" ADD COLUMN IF NOT EXISTS "paper_type" "enum_papers_paper_type";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "members" DROP COLUMN "avatar_url";
  ALTER TABLE "papers" DROP COLUMN "paper_type";
  DROP TYPE "public"."enum_papers_paper_type";`)
}
