import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_members_agent_metadata_capabilities" AS ENUM('post', 'comment', 'edit-own', 'signal', 'read-wiki', 'write-wiki');
  CREATE TYPE "public"."enum_members_ovix_profile_workforce_footprint_work_model" AS ENUM('in-office', 'hybrid', 'virtual');
  CREATE TYPE "public"."enum_members_ovix_profile_workforce_footprint_geo_spread" AS ENUM('single-city', 'single-state', 'regional-us', 'national-us', 'multi-country', 'global');
  CREATE TYPE "public"."enum_members_membership_tier" AS ENUM('free', 'trial', 'practitioner', 'practitioner-plus');
  CREATE TYPE "public"."enum_members_agent_metadata_specialization" AS ENUM('knowledge-scout', 'incident-analyst', 'tool-builder', 'content-curator', 'research-assistant', 'operations-monitor', 'other');
  CREATE TYPE "public"."enum_papers_category" AS ENUM('queuing-theory', 'ai-machine-learning', 'operations-management', 'workforce-management', 'customer-experience', 'analytics-forecasting', 'process-optimization', 'technology', 'economics-finance', 'other');
  CREATE TYPE "public"."enum_articles_category" AS ENUM('think-tank', 'topic-surface', 'wiki-highlight', 'research-finding', 'opinion', 'tutorial', 'industry-analysis');
  CREATE TYPE "public"."enum_briefs_category" AS ENUM('weather', 'seismic', 'disaster', 'cyber', 'health', 'infrastructure', 'financial', 'environmental', 'summary', 'general');
  CREATE TYPE "public"."enum_briefs_brief_type" AS ENUM('incident', 'summary', 'analysis');
  CREATE TYPE "public"."enum_briefs_severity_label" AS ENUM('info', 'moderate', 'severe', 'extreme');
  CREATE TYPE "public"."enum_briefs_status" AS ENUM('published', 'archived');
  CREATE TYPE "public"."enum_signals_signal_type" AS ENUM('ai', 'alert', 'ovix', 'member');
  CREATE TYPE "public"."enum_signals_severity_label" AS ENUM('info', 'moderate', 'severe', 'extreme');
  CREATE TYPE "public"."enum_signals_category" AS ENUM('weather', 'seismic', 'disaster', 'events', 'cyber', 'infrastructure', 'health', 'financial', 'environmental', 'general');
  ALTER TYPE "public"."enum_members_workforce_types" ADD VALUE 'help-desk' BEFORE 'field-service';
  ALTER TYPE "public"."enum_members_workforce_types" ADD VALUE 'claims-processing' BEFORE 'field-service';
  ALTER TYPE "public"."enum_members_workforce_types" ADD VALUE 'collections' BEFORE 'field-service';
  ALTER TYPE "public"."enum_members_workforce_types" ADD VALUE 'sales' BEFORE 'field-service';
  ALTER TYPE "public"."enum_members_ovix_profile_workforce_footprint_workforce_type" ADD VALUE 'help-desk' BEFORE 'other';
  ALTER TYPE "public"."enum_members_ovix_profile_workforce_footprint_workforce_type" ADD VALUE 'claims-processing' BEFORE 'other';
  ALTER TYPE "public"."enum_members_ovix_profile_workforce_footprint_workforce_type" ADD VALUE 'collections' BEFORE 'other';
  ALTER TYPE "public"."enum_members_ovix_profile_workforce_footprint_workforce_type" ADD VALUE 'sales' BEFORE 'other';
  ALTER TYPE "public"."enum_members_ovix_profile_workforce_footprint_workforce_type" ADD VALUE 'field-service' BEFORE 'other';
  CREATE TABLE "members_agent_metadata_capabilities" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_members_agent_metadata_capabilities",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "briefs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"category" "enum_briefs_category" NOT NULL,
  	"brief_type" "enum_briefs_brief_type" DEFAULT 'incident' NOT NULL,
  	"severity" numeric,
  	"severity_label" "enum_briefs_severity_label",
  	"body" jsonb NOT NULL,
  	"excerpt" varchar,
  	"region_id" varchar,
  	"region_name" varchar,
  	"agent_id" integer NOT NULL,
  	"related_signal" numeric,
  	"source_url" varchar,
  	"status" "enum_briefs_status" DEFAULT 'published',
  	"published_at" timestamp(3) with time zone,
  	"metadata" jsonb,
  	"stats_discussion_count" numeric DEFAULT 0,
  	"stats_reaction_count" numeric DEFAULT 0,
  	"stats_view_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "briefs_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"topics_id" integer
  );
  
  CREATE TABLE "signals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"signal_type" "enum_signals_signal_type" NOT NULL,
  	"title" varchar NOT NULL,
  	"message" varchar NOT NULL,
  	"source" varchar NOT NULL,
  	"severity" numeric,
  	"severity_label" "enum_signals_severity_label",
  	"category" "enum_signals_category",
  	"region_id" varchar,
  	"region_name" varchar,
  	"author_id" integer,
  	"source_url" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "members_ovix_profile_workforce_footprint" ADD COLUMN "work_model" "enum_members_ovix_profile_workforce_footprint_work_model" DEFAULT 'in-office';
  ALTER TABLE "members_ovix_profile_workforce_footprint" ADD COLUMN "geo_spread" "enum_members_ovix_profile_workforce_footprint_geo_spread";
  ALTER TABLE "members" ADD COLUMN "membership_tier" "enum_members_membership_tier" DEFAULT 'free';
  ALTER TABLE "members" ADD COLUMN "trial_expires_at" timestamp(3) with time zone;
  ALTER TABLE "members" ADD COLUMN "member_since" timestamp(3) with time zone;
  ALTER TABLE "members" ADD COLUMN "agent_metadata_specialization" "enum_members_agent_metadata_specialization";
  ALTER TABLE "members" ADD COLUMN "agent_metadata_cadence" varchar;
  ALTER TABLE "members" ADD COLUMN "agent_metadata_model" varchar;
  ALTER TABLE "members" ADD COLUMN "agent_metadata_data_sources" varchar;
  ALTER TABLE "members" ADD COLUMN "agent_metadata_personality" varchar;
  ALTER TABLE "members" ADD COLUMN "agent_metadata_last_run_at" timestamp(3) with time zone;
  ALTER TABLE "members" ADD COLUMN "agent_metadata_total_posts" numeric DEFAULT 0;
  ALTER TABLE "members" ADD COLUMN "agent_metadata_total_comments" numeric DEFAULT 0;
  ALTER TABLE "members" ADD COLUMN "agent_metadata_worker_url" varchar;
  ALTER TABLE "papers" ADD COLUMN "source_name" varchar;
  ALTER TABLE "papers" ADD COLUMN "category" "enum_papers_category";
  ALTER TABLE "articles" ADD COLUMN "category" "enum_articles_category";
  ALTER TABLE "wiki_entries_rels" ADD COLUMN "briefs_id" integer;
  ALTER TABLE "discussions_rels" ADD COLUMN "briefs_id" integer;
  ALTER TABLE "asset_versions_rels" ADD COLUMN "briefs_id" integer;
  ALTER TABLE "asset_relationships_rels" ADD COLUMN "briefs_id" integer;
  ALTER TABLE "asset_contributions_rels" ADD COLUMN "briefs_id" integer;
  ALTER TABLE "reactions_rels" ADD COLUMN "briefs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "briefs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "signals_id" integer;
  ALTER TABLE "members_agent_metadata_capabilities" ADD CONSTRAINT "members_agent_metadata_capabilities_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "briefs" ADD CONSTRAINT "briefs_agent_id_members_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "briefs_rels" ADD CONSTRAINT "briefs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."briefs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "briefs_rels" ADD CONSTRAINT "briefs_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "signals" ADD CONSTRAINT "signals_author_id_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "members_agent_metadata_capabilities_order_idx" ON "members_agent_metadata_capabilities" USING btree ("order");
  CREATE INDEX "members_agent_metadata_capabilities_parent_idx" ON "members_agent_metadata_capabilities" USING btree ("parent_id");
  CREATE UNIQUE INDEX "briefs_slug_idx" ON "briefs" USING btree ("slug");
  CREATE INDEX "briefs_agent_idx" ON "briefs" USING btree ("agent_id");
  CREATE INDEX "briefs_updated_at_idx" ON "briefs" USING btree ("updated_at");
  CREATE INDEX "briefs_created_at_idx" ON "briefs" USING btree ("created_at");
  CREATE INDEX "briefs_rels_order_idx" ON "briefs_rels" USING btree ("order");
  CREATE INDEX "briefs_rels_parent_idx" ON "briefs_rels" USING btree ("parent_id");
  CREATE INDEX "briefs_rels_path_idx" ON "briefs_rels" USING btree ("path");
  CREATE INDEX "briefs_rels_topics_id_idx" ON "briefs_rels" USING btree ("topics_id");
  CREATE INDEX "signals_author_idx" ON "signals" USING btree ("author_id");
  CREATE INDEX "signals_updated_at_idx" ON "signals" USING btree ("updated_at");
  CREATE INDEX "signals_created_at_idx" ON "signals" USING btree ("created_at");
  ALTER TABLE "wiki_entries_rels" ADD CONSTRAINT "wiki_entries_rels_briefs_fk" FOREIGN KEY ("briefs_id") REFERENCES "public"."briefs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "discussions_rels" ADD CONSTRAINT "discussions_rels_briefs_fk" FOREIGN KEY ("briefs_id") REFERENCES "public"."briefs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_versions_rels" ADD CONSTRAINT "asset_versions_rels_briefs_fk" FOREIGN KEY ("briefs_id") REFERENCES "public"."briefs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_relationships_rels" ADD CONSTRAINT "asset_relationships_rels_briefs_fk" FOREIGN KEY ("briefs_id") REFERENCES "public"."briefs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_contributions_rels" ADD CONSTRAINT "asset_contributions_rels_briefs_fk" FOREIGN KEY ("briefs_id") REFERENCES "public"."briefs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reactions_rels" ADD CONSTRAINT "reactions_rels_briefs_fk" FOREIGN KEY ("briefs_id") REFERENCES "public"."briefs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_briefs_fk" FOREIGN KEY ("briefs_id") REFERENCES "public"."briefs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_signals_fk" FOREIGN KEY ("signals_id") REFERENCES "public"."signals"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "wiki_entries_rels_briefs_id_idx" ON "wiki_entries_rels" USING btree ("briefs_id");
  CREATE INDEX "discussions_rels_briefs_id_idx" ON "discussions_rels" USING btree ("briefs_id");
  CREATE INDEX "asset_versions_rels_briefs_id_idx" ON "asset_versions_rels" USING btree ("briefs_id");
  CREATE INDEX "asset_relationships_rels_briefs_id_idx" ON "asset_relationships_rels" USING btree ("briefs_id");
  CREATE INDEX "asset_contributions_rels_briefs_id_idx" ON "asset_contributions_rels" USING btree ("briefs_id");
  CREATE INDEX "reactions_rels_briefs_id_idx" ON "reactions_rels" USING btree ("briefs_id");
  CREATE INDEX "payload_locked_documents_rels_briefs_id_idx" ON "payload_locked_documents_rels" USING btree ("briefs_id");
  CREATE INDEX "payload_locked_documents_rels_signals_id_idx" ON "payload_locked_documents_rels" USING btree ("signals_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "members_agent_metadata_capabilities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "briefs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "briefs_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "signals" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "members_agent_metadata_capabilities" CASCADE;
  DROP TABLE "briefs" CASCADE;
  DROP TABLE "briefs_rels" CASCADE;
  DROP TABLE "signals" CASCADE;
  ALTER TABLE "wiki_entries_rels" DROP CONSTRAINT "wiki_entries_rels_briefs_fk";
  
  ALTER TABLE "discussions_rels" DROP CONSTRAINT "discussions_rels_briefs_fk";
  
  ALTER TABLE "asset_versions_rels" DROP CONSTRAINT "asset_versions_rels_briefs_fk";
  
  ALTER TABLE "asset_relationships_rels" DROP CONSTRAINT "asset_relationships_rels_briefs_fk";
  
  ALTER TABLE "asset_contributions_rels" DROP CONSTRAINT "asset_contributions_rels_briefs_fk";
  
  ALTER TABLE "reactions_rels" DROP CONSTRAINT "reactions_rels_briefs_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_briefs_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_signals_fk";
  
  ALTER TABLE "members_workforce_types" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_members_workforce_types";
  CREATE TYPE "public"."enum_members_workforce_types" AS ENUM('contact-center', 'back-office', 'field-service', 'consultant-advisory', 'other');
  ALTER TABLE "members_workforce_types" ALTER COLUMN "value" SET DATA TYPE "public"."enum_members_workforce_types" USING "value"::"public"."enum_members_workforce_types";
  ALTER TABLE "members_ovix_profile_workforce_footprint" ALTER COLUMN "workforce_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_members_ovix_profile_workforce_footprint_workforce_type";
  CREATE TYPE "public"."enum_members_ovix_profile_workforce_footprint_workforce_type" AS ENUM('contact-center', 'back-office', 'other');
  ALTER TABLE "members_ovix_profile_workforce_footprint" ALTER COLUMN "workforce_type" SET DATA TYPE "public"."enum_members_ovix_profile_workforce_footprint_workforce_type" USING "workforce_type"::"public"."enum_members_ovix_profile_workforce_footprint_workforce_type";
  DROP INDEX "wiki_entries_rels_briefs_id_idx";
  DROP INDEX "discussions_rels_briefs_id_idx";
  DROP INDEX "asset_versions_rels_briefs_id_idx";
  DROP INDEX "asset_relationships_rels_briefs_id_idx";
  DROP INDEX "asset_contributions_rels_briefs_id_idx";
  DROP INDEX "reactions_rels_briefs_id_idx";
  DROP INDEX "payload_locked_documents_rels_briefs_id_idx";
  DROP INDEX "payload_locked_documents_rels_signals_id_idx";
  ALTER TABLE "members_ovix_profile_workforce_footprint" DROP COLUMN "work_model";
  ALTER TABLE "members_ovix_profile_workforce_footprint" DROP COLUMN "geo_spread";
  ALTER TABLE "members" DROP COLUMN "membership_tier";
  ALTER TABLE "members" DROP COLUMN "trial_expires_at";
  ALTER TABLE "members" DROP COLUMN "member_since";
  ALTER TABLE "members" DROP COLUMN "agent_metadata_specialization";
  ALTER TABLE "members" DROP COLUMN "agent_metadata_cadence";
  ALTER TABLE "members" DROP COLUMN "agent_metadata_model";
  ALTER TABLE "members" DROP COLUMN "agent_metadata_data_sources";
  ALTER TABLE "members" DROP COLUMN "agent_metadata_personality";
  ALTER TABLE "members" DROP COLUMN "agent_metadata_last_run_at";
  ALTER TABLE "members" DROP COLUMN "agent_metadata_total_posts";
  ALTER TABLE "members" DROP COLUMN "agent_metadata_total_comments";
  ALTER TABLE "members" DROP COLUMN "agent_metadata_worker_url";
  ALTER TABLE "papers" DROP COLUMN "source_name";
  ALTER TABLE "papers" DROP COLUMN "category";
  ALTER TABLE "articles" DROP COLUMN "category";
  ALTER TABLE "wiki_entries_rels" DROP COLUMN "briefs_id";
  ALTER TABLE "discussions_rels" DROP COLUMN "briefs_id";
  ALTER TABLE "asset_versions_rels" DROP COLUMN "briefs_id";
  ALTER TABLE "asset_relationships_rels" DROP COLUMN "briefs_id";
  ALTER TABLE "asset_contributions_rels" DROP COLUMN "briefs_id";
  ALTER TABLE "reactions_rels" DROP COLUMN "briefs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "briefs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "signals_id";
  DROP TYPE "public"."enum_members_agent_metadata_capabilities";
  DROP TYPE "public"."enum_members_ovix_profile_workforce_footprint_work_model";
  DROP TYPE "public"."enum_members_ovix_profile_workforce_footprint_geo_spread";
  DROP TYPE "public"."enum_members_membership_tier";
  DROP TYPE "public"."enum_members_agent_metadata_specialization";
  DROP TYPE "public"."enum_papers_category";
  DROP TYPE "public"."enum_articles_category";
  DROP TYPE "public"."enum_briefs_category";
  DROP TYPE "public"."enum_briefs_brief_type";
  DROP TYPE "public"."enum_briefs_severity_label";
  DROP TYPE "public"."enum_briefs_status";
  DROP TYPE "public"."enum_signals_signal_type";
  DROP TYPE "public"."enum_signals_severity_label";
  DROP TYPE "public"."enum_signals_category";`)
}
