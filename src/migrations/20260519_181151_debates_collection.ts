import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_debates_status" AS ENUM('harvesting', 'framing', 'round_1', 'round_2', 'closing', 'voting', 'decided', 'archived');
  CREATE TYPE "public"."enum_debates_category" AS ENUM('service-levels', 'staffing', 'automation', 'ai-workforce', 'scheduling', 'forecasting', 'attrition', 'outsourcing', 'technology', 'leadership', 'cost-optimization', 'cx-vs-cost');
  CREATE TYPE "public"."enum_debates_difficulty" AS ENUM('foundational', 'intermediate', 'advanced');
  CREATE TYPE "public"."enum_debates_winner" AS ENUM('advocate', 'challenger', 'draw');
  CREATE TYPE "public"."enum_tools_domain" AS ENUM('staffing-capacity', 'forecasting-accuracy', 'workforce-economics', 'operations-routing', 'measurement-analytics');
  CREATE TYPE "public"."enum_docs_type" AS ENUM('architecture', 'section', 'stream', 'decision', 'agent');
  CREATE TYPE "public"."enum_docs_status" AS ENUM('draft', 'active', 'completed', 'archived');
  ALTER TYPE "public"."enum_papers_category" ADD VALUE 'employee-wellbeing' BEFORE 'other';
  ALTER TYPE "public"."enum_papers_category" ADD VALUE 'contact-center-operations' BEFORE 'other';
  ALTER TYPE "public"."enum_papers_category" ADD VALUE 'scheduling-optimization' BEFORE 'other';
  ALTER TYPE "public"."enum_briefs_category" ADD VALUE 'geopolitical' BEFORE 'summary';
  ALTER TYPE "public"."enum_signals_category" ADD VALUE 'geopolitical' BEFORE 'general';
  CREATE TABLE "debates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"status" "enum_debates_status" DEFAULT 'framing' NOT NULL,
  	"category" "enum_debates_category",
  	"difficulty" "enum_debates_difficulty",
  	"context" varchar,
  	"stakes" varchar,
  	"advocate_position" varchar,
  	"advocate_opening" varchar,
  	"advocate_rebuttal" varchar,
  	"advocate_closing" varchar,
  	"challenger_position" varchar,
  	"challenger_opening" varchar,
  	"challenger_rebuttal" varchar,
  	"challenger_closing" varchar,
  	"advocate_votes" numeric DEFAULT 0,
  	"challenger_votes" numeric DEFAULT 0,
  	"voting_opens_at" timestamp(3) with time zone,
  	"voting_closes_at" timestamp(3) with time zone,
  	"winner" "enum_debates_winner",
  	"verdict" varchar,
  	"primary_contributor_id" integer,
  	"published_at" timestamp(3) with time zone,
  	"decided_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "debates_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tools_id" integer,
  	"signals_id" integer
  );
  
  CREATE TABLE "docs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum_docs_type" NOT NULL,
  	"section_id" integer,
  	"status" "enum_docs_status" DEFAULT 'draft' NOT NULL,
  	"stream_id" varchar,
  	"title" varchar NOT NULL,
  	"body" jsonb,
  	"conductor_session" varchar,
  	"last_synced_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "docs_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"docs_id" integer
  );
  
  ALTER TABLE "tools" ALTER COLUMN "category" SET DATA TYPE text;
  DROP TYPE "public"."enum_tools_category";
  CREATE TYPE "public"."enum_tools_category" AS ENUM('calculator', 'analyzer', 'simulator', 'model', 'methodology');
  ALTER TABLE "tools" ALTER COLUMN "category" SET DATA TYPE "public"."enum_tools_category" USING "category"::"public"."enum_tools_category";
  ALTER TABLE "tools" ADD COLUMN "domain" "enum_tools_domain";
  ALTER TABLE "wiki_entries_rels" ADD COLUMN "debates_id" integer;
  ALTER TABLE "discussions_rels" ADD COLUMN "debates_id" integer;
  ALTER TABLE "asset_versions_rels" ADD COLUMN "debates_id" integer;
  ALTER TABLE "asset_relationships_rels" ADD COLUMN "debates_id" integer;
  ALTER TABLE "asset_contributions_rels" ADD COLUMN "debates_id" integer;
  ALTER TABLE "reactions_rels" ADD COLUMN "debates_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "debates_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "docs_id" integer;
  ALTER TABLE "debates" ADD CONSTRAINT "debates_primary_contributor_id_members_id_fk" FOREIGN KEY ("primary_contributor_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "debates_rels" ADD CONSTRAINT "debates_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."debates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "debates_rels" ADD CONSTRAINT "debates_rels_tools_fk" FOREIGN KEY ("tools_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "debates_rels" ADD CONSTRAINT "debates_rels_signals_fk" FOREIGN KEY ("signals_id") REFERENCES "public"."signals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "docs" ADD CONSTRAINT "docs_section_id_docs_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."docs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "docs" ADD CONSTRAINT "docs_created_by_id_members_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "docs_rels" ADD CONSTRAINT "docs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."docs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "docs_rels" ADD CONSTRAINT "docs_rels_docs_fk" FOREIGN KEY ("docs_id") REFERENCES "public"."docs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "debates_slug_idx" ON "debates" USING btree ("slug");
  CREATE INDEX "debates_primary_contributor_idx" ON "debates" USING btree ("primary_contributor_id");
  CREATE INDEX "debates_updated_at_idx" ON "debates" USING btree ("updated_at");
  CREATE INDEX "debates_created_at_idx" ON "debates" USING btree ("created_at");
  CREATE INDEX "debates_rels_order_idx" ON "debates_rels" USING btree ("order");
  CREATE INDEX "debates_rels_parent_idx" ON "debates_rels" USING btree ("parent_id");
  CREATE INDEX "debates_rels_path_idx" ON "debates_rels" USING btree ("path");
  CREATE INDEX "debates_rels_tools_id_idx" ON "debates_rels" USING btree ("tools_id");
  CREATE INDEX "debates_rels_signals_id_idx" ON "debates_rels" USING btree ("signals_id");
  CREATE INDEX "docs_section_idx" ON "docs" USING btree ("section_id");
  CREATE INDEX "docs_created_by_idx" ON "docs" USING btree ("created_by_id");
  CREATE INDEX "docs_updated_at_idx" ON "docs" USING btree ("updated_at");
  CREATE INDEX "docs_created_at_idx" ON "docs" USING btree ("created_at");
  CREATE INDEX "docs_rels_order_idx" ON "docs_rels" USING btree ("order");
  CREATE INDEX "docs_rels_parent_idx" ON "docs_rels" USING btree ("parent_id");
  CREATE INDEX "docs_rels_path_idx" ON "docs_rels" USING btree ("path");
  CREATE INDEX "docs_rels_docs_id_idx" ON "docs_rels" USING btree ("docs_id");
  ALTER TABLE "wiki_entries_rels" ADD CONSTRAINT "wiki_entries_rels_debates_fk" FOREIGN KEY ("debates_id") REFERENCES "public"."debates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "discussions_rels" ADD CONSTRAINT "discussions_rels_debates_fk" FOREIGN KEY ("debates_id") REFERENCES "public"."debates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_versions_rels" ADD CONSTRAINT "asset_versions_rels_debates_fk" FOREIGN KEY ("debates_id") REFERENCES "public"."debates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_relationships_rels" ADD CONSTRAINT "asset_relationships_rels_debates_fk" FOREIGN KEY ("debates_id") REFERENCES "public"."debates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_contributions_rels" ADD CONSTRAINT "asset_contributions_rels_debates_fk" FOREIGN KEY ("debates_id") REFERENCES "public"."debates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reactions_rels" ADD CONSTRAINT "reactions_rels_debates_fk" FOREIGN KEY ("debates_id") REFERENCES "public"."debates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_debates_fk" FOREIGN KEY ("debates_id") REFERENCES "public"."debates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_docs_fk" FOREIGN KEY ("docs_id") REFERENCES "public"."docs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "wiki_entries_rels_debates_id_idx" ON "wiki_entries_rels" USING btree ("debates_id");
  CREATE INDEX "discussions_rels_debates_id_idx" ON "discussions_rels" USING btree ("debates_id");
  CREATE INDEX "asset_versions_rels_debates_id_idx" ON "asset_versions_rels" USING btree ("debates_id");
  CREATE INDEX "asset_relationships_rels_debates_id_idx" ON "asset_relationships_rels" USING btree ("debates_id");
  CREATE INDEX "asset_contributions_rels_debates_id_idx" ON "asset_contributions_rels" USING btree ("debates_id");
  CREATE INDEX "reactions_rels_debates_id_idx" ON "reactions_rels" USING btree ("debates_id");
  CREATE INDEX "payload_locked_documents_rels_debates_id_idx" ON "payload_locked_documents_rels" USING btree ("debates_id");
  CREATE INDEX "payload_locked_documents_rels_docs_id_idx" ON "payload_locked_documents_rels" USING btree ("docs_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "debates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "debates_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "docs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "docs_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "debates" CASCADE;
  DROP TABLE "debates_rels" CASCADE;
  DROP TABLE "docs" CASCADE;
  DROP TABLE "docs_rels" CASCADE;
  ALTER TABLE "wiki_entries_rels" DROP CONSTRAINT "wiki_entries_rels_debates_fk";
  
  ALTER TABLE "discussions_rels" DROP CONSTRAINT "discussions_rels_debates_fk";
  
  ALTER TABLE "asset_versions_rels" DROP CONSTRAINT "asset_versions_rels_debates_fk";
  
  ALTER TABLE "asset_relationships_rels" DROP CONSTRAINT "asset_relationships_rels_debates_fk";
  
  ALTER TABLE "asset_contributions_rels" DROP CONSTRAINT "asset_contributions_rels_debates_fk";
  
  ALTER TABLE "reactions_rels" DROP CONSTRAINT "reactions_rels_debates_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_debates_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_docs_fk";
  
  ALTER TABLE "papers" ALTER COLUMN "category" SET DATA TYPE text;
  DROP TYPE "public"."enum_papers_category";
  CREATE TYPE "public"."enum_papers_category" AS ENUM('queuing-theory', 'ai-machine-learning', 'operations-management', 'workforce-management', 'customer-experience', 'analytics-forecasting', 'process-optimization', 'technology', 'economics-finance', 'other');
  ALTER TABLE "papers" ALTER COLUMN "category" SET DATA TYPE "public"."enum_papers_category" USING "category"::"public"."enum_papers_category";
  ALTER TABLE "briefs" ALTER COLUMN "category" SET DATA TYPE text;
  DROP TYPE "public"."enum_briefs_category";
  CREATE TYPE "public"."enum_briefs_category" AS ENUM('weather', 'seismic', 'disaster', 'cyber', 'health', 'infrastructure', 'financial', 'environmental', 'summary', 'general');
  ALTER TABLE "briefs" ALTER COLUMN "category" SET DATA TYPE "public"."enum_briefs_category" USING "category"::"public"."enum_briefs_category";
  ALTER TABLE "tools" ALTER COLUMN "category" SET DATA TYPE text;
  DROP TYPE "public"."enum_tools_category";
  CREATE TYPE "public"."enum_tools_category" AS ENUM('capacity-planning', 'forecasting', 'scheduling', 'analytics', 'value-planning', 'staffing');
  ALTER TABLE "tools" ALTER COLUMN "category" SET DATA TYPE "public"."enum_tools_category" USING "category"::"public"."enum_tools_category";
  ALTER TABLE "signals" ALTER COLUMN "category" SET DATA TYPE text;
  DROP TYPE "public"."enum_signals_category";
  CREATE TYPE "public"."enum_signals_category" AS ENUM('weather', 'seismic', 'disaster', 'events', 'cyber', 'infrastructure', 'health', 'financial', 'environmental', 'general');
  ALTER TABLE "signals" ALTER COLUMN "category" SET DATA TYPE "public"."enum_signals_category" USING "category"::"public"."enum_signals_category";
  DROP INDEX "wiki_entries_rels_debates_id_idx";
  DROP INDEX "discussions_rels_debates_id_idx";
  DROP INDEX "asset_versions_rels_debates_id_idx";
  DROP INDEX "asset_relationships_rels_debates_id_idx";
  DROP INDEX "asset_contributions_rels_debates_id_idx";
  DROP INDEX "reactions_rels_debates_id_idx";
  DROP INDEX "payload_locked_documents_rels_debates_id_idx";
  DROP INDEX "payload_locked_documents_rels_docs_id_idx";
  ALTER TABLE "tools" DROP COLUMN "domain";
  ALTER TABLE "wiki_entries_rels" DROP COLUMN "debates_id";
  ALTER TABLE "discussions_rels" DROP COLUMN "debates_id";
  ALTER TABLE "asset_versions_rels" DROP COLUMN "debates_id";
  ALTER TABLE "asset_relationships_rels" DROP COLUMN "debates_id";
  ALTER TABLE "asset_contributions_rels" DROP COLUMN "debates_id";
  ALTER TABLE "reactions_rels" DROP COLUMN "debates_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "debates_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "docs_id";
  DROP TYPE "public"."enum_debates_status";
  DROP TYPE "public"."enum_debates_category";
  DROP TYPE "public"."enum_debates_difficulty";
  DROP TYPE "public"."enum_debates_winner";
  DROP TYPE "public"."enum_tools_domain";
  DROP TYPE "public"."enum_docs_type";
  DROP TYPE "public"."enum_docs_status";`)
}
