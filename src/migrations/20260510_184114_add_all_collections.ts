import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_papers_status" AS ENUM('draft', 'proposed', 'published', 'refined', 'mature', 'deprecated', 'archived');
  CREATE TYPE "public"."enum_papers_tier" AS ENUM('public', 'free', 'practitioner', 'practitioner-plus');
  CREATE TYPE "public"."enum_papers_source_type" AS ENUM('arxiv', 'ssrn', 'journal', 'industry-report', 'blog', 'vendor-research', 'manual');
  CREATE TYPE "public"."enum_articles_status" AS ENUM('draft', 'proposed', 'published', 'refined', 'mature', 'deprecated', 'archived');
  CREATE TYPE "public"."enum_articles_tier" AS ENUM('public', 'free', 'practitioner', 'practitioner-plus');
  CREATE TYPE "public"."enum_tools_status" AS ENUM('draft', 'proposed', 'published', 'refined', 'mature', 'deprecated', 'archived');
  CREATE TYPE "public"."enum_tools_tier" AS ENUM('public', 'free', 'practitioner', 'practitioner-plus');
  CREATE TYPE "public"."enum_tools_category" AS ENUM('capacity-planning', 'forecasting', 'scheduling', 'analytics', 'value-planning', 'staffing');
  CREATE TYPE "public"."enum_newsletter_issues_status" AS ENUM('draft', 'proposed', 'published', 'refined', 'mature', 'deprecated', 'archived');
  CREATE TYPE "public"."enum_newsletter_issues_tier" AS ENUM('public', 'free', 'practitioner', 'practitioner-plus');
  CREATE TYPE "public"."enum_wiki_entries_status" AS ENUM('draft', 'proposed', 'published', 'refined', 'mature', 'deprecated', 'archived');
  CREATE TYPE "public"."enum_wiki_entries_tier" AS ENUM('public', 'free', 'practitioner', 'practitioner-plus');
  CREATE TYPE "public"."enum_wiki_entries_category" AS ENUM('concept', 'process', 'metric', 'technology', 'framework', 'role', 'glossary');
  CREATE TYPE "public"."enum_asset_versions_change_type" AS ENUM('create', 'update', 'status-change', 'major-revision', 'minor-edit');
  CREATE TYPE "public"."enum_asset_relationships_relationship_type" AS ENUM('cites', 'implements', 'documents', 'critiques', 'extends', 'supersedes', 'requires', 'related-to', 'derived-from', 'mentions');
  CREATE TYPE "public"."enum_asset_contributions_contribution_type" AS ENUM('primary-author', 'co-author', 'editor', 'reviewer', 'curator', 'updater');
  CREATE TYPE "public"."enum_reactions_type" AS ENUM('like', 'insightful', 'practical', 'question');
  CREATE TABLE "topics" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"parent_topic_id" integer,
  	"is_featured" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "papers_authors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"affiliation" varchar
  );
  
  CREATE TABLE "papers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"primary_contributor_id" integer NOT NULL,
  	"description" varchar,
  	"cover_image_id" integer,
  	"status" "enum_papers_status" DEFAULT 'draft',
  	"published_at" timestamp(3) with time zone,
  	"reviewed_at" timestamp(3) with time zone,
  	"review_interval_days" numeric DEFAULT 180,
  	"tier" "enum_papers_tier" DEFAULT 'practitioner',
  	"is_featured" boolean DEFAULT false,
  	"stats_discussion_count" numeric DEFAULT 0,
  	"stats_reaction_count" numeric DEFAULT 0,
  	"stats_contributor_count" numeric DEFAULT 0,
  	"stats_view_count" numeric DEFAULT 0,
  	"stats_citation_count" numeric DEFAULT 0,
  	"source_url" varchar NOT NULL,
  	"source_type" "enum_papers_source_type",
  	"abstract" varchar,
  	"full_text" varchar,
  	"curator_summary" jsonb,
  	"why_it_matters" jsonb,
  	"caveats" jsonb,
  	"pdf_file_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "papers_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"topics_id" integer
  );
  
  CREATE TABLE "articles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"primary_contributor_id" integer NOT NULL,
  	"description" varchar,
  	"cover_image_id" integer,
  	"status" "enum_articles_status" DEFAULT 'draft',
  	"published_at" timestamp(3) with time zone,
  	"reviewed_at" timestamp(3) with time zone,
  	"review_interval_days" numeric DEFAULT 180,
  	"tier" "enum_articles_tier" DEFAULT 'practitioner',
  	"is_featured" boolean DEFAULT false,
  	"stats_discussion_count" numeric DEFAULT 0,
  	"stats_reaction_count" numeric DEFAULT 0,
  	"stats_contributor_count" numeric DEFAULT 0,
  	"stats_view_count" numeric DEFAULT 0,
  	"stats_citation_count" numeric DEFAULT 0,
  	"author_id" integer,
  	"publish_date" timestamp(3) with time zone,
  	"body" jsonb NOT NULL,
  	"excerpt" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "articles_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"topics_id" integer
  );
  
  CREATE TABLE "tools" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"primary_contributor_id" integer NOT NULL,
  	"description" varchar,
  	"cover_image_id" integer,
  	"status" "enum_tools_status" DEFAULT 'draft',
  	"published_at" timestamp(3) with time zone,
  	"reviewed_at" timestamp(3) with time zone,
  	"review_interval_days" numeric DEFAULT 180,
  	"tier" "enum_tools_tier" DEFAULT 'practitioner',
  	"is_featured" boolean DEFAULT false,
  	"stats_discussion_count" numeric DEFAULT 0,
  	"stats_reaction_count" numeric DEFAULT 0,
  	"stats_contributor_count" numeric DEFAULT 0,
  	"stats_view_count" numeric DEFAULT 0,
  	"stats_citation_count" numeric DEFAULT 0,
  	"embed_url" varchar,
  	"source_code_url" varchar,
  	"category" "enum_tools_category",
  	"methodology" jsonb,
  	"version" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tools_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"topics_id" integer
  );
  
  CREATE TABLE "newsletter_issues" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"primary_contributor_id" integer NOT NULL,
  	"description" varchar,
  	"cover_image_id" integer,
  	"status" "enum_newsletter_issues_status" DEFAULT 'draft',
  	"published_at" timestamp(3) with time zone,
  	"reviewed_at" timestamp(3) with time zone,
  	"review_interval_days" numeric DEFAULT 180,
  	"tier" "enum_newsletter_issues_tier" DEFAULT 'practitioner',
  	"is_featured" boolean DEFAULT false,
  	"stats_discussion_count" numeric DEFAULT 0,
  	"stats_reaction_count" numeric DEFAULT 0,
  	"stats_contributor_count" numeric DEFAULT 0,
  	"stats_view_count" numeric DEFAULT 0,
  	"stats_citation_count" numeric DEFAULT 0,
  	"issue_number" numeric NOT NULL,
  	"publish_date" timestamp(3) with time zone NOT NULL,
  	"body" jsonb NOT NULL,
  	"summary" varchar,
  	"author_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "newsletter_issues_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"topics_id" integer
  );
  
  CREATE TABLE "wiki_entries_defined_terms" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"term" varchar NOT NULL,
  	"definition" varchar NOT NULL
  );
  
  CREATE TABLE "wiki_entries_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"url" varchar,
  	"note" varchar
  );
  
  CREATE TABLE "wiki_entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"primary_contributor_id" integer NOT NULL,
  	"description" varchar,
  	"cover_image_id" integer,
  	"status" "enum_wiki_entries_status" DEFAULT 'draft',
  	"published_at" timestamp(3) with time zone,
  	"reviewed_at" timestamp(3) with time zone,
  	"review_interval_days" numeric DEFAULT 180,
  	"tier" "enum_wiki_entries_tier" DEFAULT 'practitioner',
  	"is_featured" boolean DEFAULT false,
  	"stats_discussion_count" numeric DEFAULT 0,
  	"stats_reaction_count" numeric DEFAULT 0,
  	"stats_contributor_count" numeric DEFAULT 0,
  	"stats_view_count" numeric DEFAULT 0,
  	"stats_citation_count" numeric DEFAULT 0,
  	"category" "enum_wiki_entries_category",
  	"body" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "wiki_entries_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"topics_id" integer,
  	"wiki_entries_id" integer,
  	"papers_id" integer,
  	"articles_id" integer,
  	"tools_id" integer,
  	"newsletter_issues_id" integer
  );
  
  CREATE TABLE "discussions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_discussion_id" integer,
  	"author_id" integer NOT NULL,
  	"body" jsonb NOT NULL,
  	"is_resolved" boolean DEFAULT false,
  	"reaction_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "discussions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"papers_id" integer,
  	"articles_id" integer,
  	"tools_id" integer,
  	"newsletter_issues_id" integer,
  	"wiki_entries_id" integer
  );
  
  CREATE TABLE "asset_versions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_number" varchar NOT NULL,
  	"changed_by_id" integer NOT NULL,
  	"change_description" varchar,
  	"snapshot" jsonb,
  	"change_type" "enum_asset_versions_change_type",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "asset_versions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"papers_id" integer,
  	"articles_id" integer,
  	"tools_id" integer,
  	"newsletter_issues_id" integer,
  	"wiki_entries_id" integer
  );
  
  CREATE TABLE "asset_relationships" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"relationship_type" "enum_asset_relationships_relationship_type" NOT NULL,
  	"created_by_id" integer,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "asset_relationships_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"papers_id" integer,
  	"articles_id" integer,
  	"tools_id" integer,
  	"newsletter_issues_id" integer,
  	"wiki_entries_id" integer
  );
  
  CREATE TABLE "asset_contributions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"contributor_id" integer NOT NULL,
  	"contribution_type" "enum_asset_contributions_contribution_type" NOT NULL,
  	"contributed_at" timestamp(3) with time zone,
  	"contribution_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "asset_contributions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"papers_id" integer,
  	"articles_id" integer,
  	"tools_id" integer,
  	"newsletter_issues_id" integer,
  	"wiki_entries_id" integer
  );
  
  CREATE TABLE "reactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"member_id" integer NOT NULL,
  	"type" "enum_reactions_type" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reactions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"papers_id" integer,
  	"articles_id" integer,
  	"tools_id" integer,
  	"newsletter_issues_id" integer,
  	"wiki_entries_id" integer,
  	"discussions_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "topics_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "papers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "articles_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tools_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "newsletter_issues_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "wiki_entries_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "discussions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "asset_versions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "asset_relationships_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "asset_contributions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reactions_id" integer;
  ALTER TABLE "topics" ADD CONSTRAINT "topics_parent_topic_id_topics_id_fk" FOREIGN KEY ("parent_topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "papers_authors" ADD CONSTRAINT "papers_authors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "papers" ADD CONSTRAINT "papers_primary_contributor_id_members_id_fk" FOREIGN KEY ("primary_contributor_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "papers" ADD CONSTRAINT "papers_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "papers" ADD CONSTRAINT "papers_pdf_file_id_media_id_fk" FOREIGN KEY ("pdf_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "papers_rels" ADD CONSTRAINT "papers_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "papers_rels" ADD CONSTRAINT "papers_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_primary_contributor_id_members_id_fk" FOREIGN KEY ("primary_contributor_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tools" ADD CONSTRAINT "tools_primary_contributor_id_members_id_fk" FOREIGN KEY ("primary_contributor_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tools" ADD CONSTRAINT "tools_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tools_rels" ADD CONSTRAINT "tools_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tools_rels" ADD CONSTRAINT "tools_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletter_issues" ADD CONSTRAINT "newsletter_issues_primary_contributor_id_members_id_fk" FOREIGN KEY ("primary_contributor_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletter_issues" ADD CONSTRAINT "newsletter_issues_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletter_issues" ADD CONSTRAINT "newsletter_issues_author_id_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletter_issues_rels" ADD CONSTRAINT "newsletter_issues_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."newsletter_issues"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletter_issues_rels" ADD CONSTRAINT "newsletter_issues_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "wiki_entries_defined_terms" ADD CONSTRAINT "wiki_entries_defined_terms_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."wiki_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "wiki_entries_sources" ADD CONSTRAINT "wiki_entries_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."wiki_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "wiki_entries" ADD CONSTRAINT "wiki_entries_primary_contributor_id_members_id_fk" FOREIGN KEY ("primary_contributor_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wiki_entries" ADD CONSTRAINT "wiki_entries_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wiki_entries_rels" ADD CONSTRAINT "wiki_entries_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."wiki_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "wiki_entries_rels" ADD CONSTRAINT "wiki_entries_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "wiki_entries_rels" ADD CONSTRAINT "wiki_entries_rels_wiki_entries_fk" FOREIGN KEY ("wiki_entries_id") REFERENCES "public"."wiki_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "wiki_entries_rels" ADD CONSTRAINT "wiki_entries_rels_papers_fk" FOREIGN KEY ("papers_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "wiki_entries_rels" ADD CONSTRAINT "wiki_entries_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "wiki_entries_rels" ADD CONSTRAINT "wiki_entries_rels_tools_fk" FOREIGN KEY ("tools_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "wiki_entries_rels" ADD CONSTRAINT "wiki_entries_rels_newsletter_issues_fk" FOREIGN KEY ("newsletter_issues_id") REFERENCES "public"."newsletter_issues"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "discussions" ADD CONSTRAINT "discussions_parent_discussion_id_discussions_id_fk" FOREIGN KEY ("parent_discussion_id") REFERENCES "public"."discussions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussions" ADD CONSTRAINT "discussions_author_id_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discussions_rels" ADD CONSTRAINT "discussions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "discussions_rels" ADD CONSTRAINT "discussions_rels_papers_fk" FOREIGN KEY ("papers_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "discussions_rels" ADD CONSTRAINT "discussions_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "discussions_rels" ADD CONSTRAINT "discussions_rels_tools_fk" FOREIGN KEY ("tools_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "discussions_rels" ADD CONSTRAINT "discussions_rels_newsletter_issues_fk" FOREIGN KEY ("newsletter_issues_id") REFERENCES "public"."newsletter_issues"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "discussions_rels" ADD CONSTRAINT "discussions_rels_wiki_entries_fk" FOREIGN KEY ("wiki_entries_id") REFERENCES "public"."wiki_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_changed_by_id_members_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "asset_versions_rels" ADD CONSTRAINT "asset_versions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."asset_versions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_versions_rels" ADD CONSTRAINT "asset_versions_rels_papers_fk" FOREIGN KEY ("papers_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_versions_rels" ADD CONSTRAINT "asset_versions_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_versions_rels" ADD CONSTRAINT "asset_versions_rels_tools_fk" FOREIGN KEY ("tools_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_versions_rels" ADD CONSTRAINT "asset_versions_rels_newsletter_issues_fk" FOREIGN KEY ("newsletter_issues_id") REFERENCES "public"."newsletter_issues"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_versions_rels" ADD CONSTRAINT "asset_versions_rels_wiki_entries_fk" FOREIGN KEY ("wiki_entries_id") REFERENCES "public"."wiki_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_relationships" ADD CONSTRAINT "asset_relationships_created_by_id_members_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "asset_relationships_rels" ADD CONSTRAINT "asset_relationships_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."asset_relationships"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_relationships_rels" ADD CONSTRAINT "asset_relationships_rels_papers_fk" FOREIGN KEY ("papers_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_relationships_rels" ADD CONSTRAINT "asset_relationships_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_relationships_rels" ADD CONSTRAINT "asset_relationships_rels_tools_fk" FOREIGN KEY ("tools_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_relationships_rels" ADD CONSTRAINT "asset_relationships_rels_newsletter_issues_fk" FOREIGN KEY ("newsletter_issues_id") REFERENCES "public"."newsletter_issues"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_relationships_rels" ADD CONSTRAINT "asset_relationships_rels_wiki_entries_fk" FOREIGN KEY ("wiki_entries_id") REFERENCES "public"."wiki_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_contributions" ADD CONSTRAINT "asset_contributions_contributor_id_members_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "asset_contributions_rels" ADD CONSTRAINT "asset_contributions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."asset_contributions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_contributions_rels" ADD CONSTRAINT "asset_contributions_rels_papers_fk" FOREIGN KEY ("papers_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_contributions_rels" ADD CONSTRAINT "asset_contributions_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_contributions_rels" ADD CONSTRAINT "asset_contributions_rels_tools_fk" FOREIGN KEY ("tools_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_contributions_rels" ADD CONSTRAINT "asset_contributions_rels_newsletter_issues_fk" FOREIGN KEY ("newsletter_issues_id") REFERENCES "public"."newsletter_issues"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "asset_contributions_rels" ADD CONSTRAINT "asset_contributions_rels_wiki_entries_fk" FOREIGN KEY ("wiki_entries_id") REFERENCES "public"."wiki_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reactions" ADD CONSTRAINT "reactions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reactions_rels" ADD CONSTRAINT "reactions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."reactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reactions_rels" ADD CONSTRAINT "reactions_rels_papers_fk" FOREIGN KEY ("papers_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reactions_rels" ADD CONSTRAINT "reactions_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reactions_rels" ADD CONSTRAINT "reactions_rels_tools_fk" FOREIGN KEY ("tools_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reactions_rels" ADD CONSTRAINT "reactions_rels_newsletter_issues_fk" FOREIGN KEY ("newsletter_issues_id") REFERENCES "public"."newsletter_issues"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reactions_rels" ADD CONSTRAINT "reactions_rels_wiki_entries_fk" FOREIGN KEY ("wiki_entries_id") REFERENCES "public"."wiki_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reactions_rels" ADD CONSTRAINT "reactions_rels_discussions_fk" FOREIGN KEY ("discussions_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "topics_slug_idx" ON "topics" USING btree ("slug");
  CREATE INDEX "topics_parent_topic_idx" ON "topics" USING btree ("parent_topic_id");
  CREATE INDEX "topics_updated_at_idx" ON "topics" USING btree ("updated_at");
  CREATE INDEX "topics_created_at_idx" ON "topics" USING btree ("created_at");
  CREATE INDEX "papers_authors_order_idx" ON "papers_authors" USING btree ("_order");
  CREATE INDEX "papers_authors_parent_id_idx" ON "papers_authors" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "papers_slug_idx" ON "papers" USING btree ("slug");
  CREATE INDEX "papers_primary_contributor_idx" ON "papers" USING btree ("primary_contributor_id");
  CREATE INDEX "papers_cover_image_idx" ON "papers" USING btree ("cover_image_id");
  CREATE INDEX "papers_pdf_file_idx" ON "papers" USING btree ("pdf_file_id");
  CREATE INDEX "papers_updated_at_idx" ON "papers" USING btree ("updated_at");
  CREATE INDEX "papers_created_at_idx" ON "papers" USING btree ("created_at");
  CREATE INDEX "papers_rels_order_idx" ON "papers_rels" USING btree ("order");
  CREATE INDEX "papers_rels_parent_idx" ON "papers_rels" USING btree ("parent_id");
  CREATE INDEX "papers_rels_path_idx" ON "papers_rels" USING btree ("path");
  CREATE INDEX "papers_rels_topics_id_idx" ON "papers_rels" USING btree ("topics_id");
  CREATE UNIQUE INDEX "articles_slug_idx" ON "articles" USING btree ("slug");
  CREATE INDEX "articles_primary_contributor_idx" ON "articles" USING btree ("primary_contributor_id");
  CREATE INDEX "articles_cover_image_idx" ON "articles" USING btree ("cover_image_id");
  CREATE INDEX "articles_author_idx" ON "articles" USING btree ("author_id");
  CREATE INDEX "articles_updated_at_idx" ON "articles" USING btree ("updated_at");
  CREATE INDEX "articles_created_at_idx" ON "articles" USING btree ("created_at");
  CREATE INDEX "articles_rels_order_idx" ON "articles_rels" USING btree ("order");
  CREATE INDEX "articles_rels_parent_idx" ON "articles_rels" USING btree ("parent_id");
  CREATE INDEX "articles_rels_path_idx" ON "articles_rels" USING btree ("path");
  CREATE INDEX "articles_rels_topics_id_idx" ON "articles_rels" USING btree ("topics_id");
  CREATE UNIQUE INDEX "tools_slug_idx" ON "tools" USING btree ("slug");
  CREATE INDEX "tools_primary_contributor_idx" ON "tools" USING btree ("primary_contributor_id");
  CREATE INDEX "tools_cover_image_idx" ON "tools" USING btree ("cover_image_id");
  CREATE INDEX "tools_updated_at_idx" ON "tools" USING btree ("updated_at");
  CREATE INDEX "tools_created_at_idx" ON "tools" USING btree ("created_at");
  CREATE INDEX "tools_rels_order_idx" ON "tools_rels" USING btree ("order");
  CREATE INDEX "tools_rels_parent_idx" ON "tools_rels" USING btree ("parent_id");
  CREATE INDEX "tools_rels_path_idx" ON "tools_rels" USING btree ("path");
  CREATE INDEX "tools_rels_topics_id_idx" ON "tools_rels" USING btree ("topics_id");
  CREATE UNIQUE INDEX "newsletter_issues_slug_idx" ON "newsletter_issues" USING btree ("slug");
  CREATE INDEX "newsletter_issues_primary_contributor_idx" ON "newsletter_issues" USING btree ("primary_contributor_id");
  CREATE INDEX "newsletter_issues_cover_image_idx" ON "newsletter_issues" USING btree ("cover_image_id");
  CREATE UNIQUE INDEX "newsletter_issues_issue_number_idx" ON "newsletter_issues" USING btree ("issue_number");
  CREATE INDEX "newsletter_issues_author_idx" ON "newsletter_issues" USING btree ("author_id");
  CREATE INDEX "newsletter_issues_updated_at_idx" ON "newsletter_issues" USING btree ("updated_at");
  CREATE INDEX "newsletter_issues_created_at_idx" ON "newsletter_issues" USING btree ("created_at");
  CREATE INDEX "newsletter_issues_rels_order_idx" ON "newsletter_issues_rels" USING btree ("order");
  CREATE INDEX "newsletter_issues_rels_parent_idx" ON "newsletter_issues_rels" USING btree ("parent_id");
  CREATE INDEX "newsletter_issues_rels_path_idx" ON "newsletter_issues_rels" USING btree ("path");
  CREATE INDEX "newsletter_issues_rels_topics_id_idx" ON "newsletter_issues_rels" USING btree ("topics_id");
  CREATE INDEX "wiki_entries_defined_terms_order_idx" ON "wiki_entries_defined_terms" USING btree ("_order");
  CREATE INDEX "wiki_entries_defined_terms_parent_id_idx" ON "wiki_entries_defined_terms" USING btree ("_parent_id");
  CREATE INDEX "wiki_entries_sources_order_idx" ON "wiki_entries_sources" USING btree ("_order");
  CREATE INDEX "wiki_entries_sources_parent_id_idx" ON "wiki_entries_sources" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "wiki_entries_slug_idx" ON "wiki_entries" USING btree ("slug");
  CREATE INDEX "wiki_entries_primary_contributor_idx" ON "wiki_entries" USING btree ("primary_contributor_id");
  CREATE INDEX "wiki_entries_cover_image_idx" ON "wiki_entries" USING btree ("cover_image_id");
  CREATE INDEX "wiki_entries_updated_at_idx" ON "wiki_entries" USING btree ("updated_at");
  CREATE INDEX "wiki_entries_created_at_idx" ON "wiki_entries" USING btree ("created_at");
  CREATE INDEX "wiki_entries_rels_order_idx" ON "wiki_entries_rels" USING btree ("order");
  CREATE INDEX "wiki_entries_rels_parent_idx" ON "wiki_entries_rels" USING btree ("parent_id");
  CREATE INDEX "wiki_entries_rels_path_idx" ON "wiki_entries_rels" USING btree ("path");
  CREATE INDEX "wiki_entries_rels_topics_id_idx" ON "wiki_entries_rels" USING btree ("topics_id");
  CREATE INDEX "wiki_entries_rels_wiki_entries_id_idx" ON "wiki_entries_rels" USING btree ("wiki_entries_id");
  CREATE INDEX "wiki_entries_rels_papers_id_idx" ON "wiki_entries_rels" USING btree ("papers_id");
  CREATE INDEX "wiki_entries_rels_articles_id_idx" ON "wiki_entries_rels" USING btree ("articles_id");
  CREATE INDEX "wiki_entries_rels_tools_id_idx" ON "wiki_entries_rels" USING btree ("tools_id");
  CREATE INDEX "wiki_entries_rels_newsletter_issues_id_idx" ON "wiki_entries_rels" USING btree ("newsletter_issues_id");
  CREATE INDEX "discussions_parent_discussion_idx" ON "discussions" USING btree ("parent_discussion_id");
  CREATE INDEX "discussions_author_idx" ON "discussions" USING btree ("author_id");
  CREATE INDEX "discussions_updated_at_idx" ON "discussions" USING btree ("updated_at");
  CREATE INDEX "discussions_created_at_idx" ON "discussions" USING btree ("created_at");
  CREATE INDEX "discussions_rels_order_idx" ON "discussions_rels" USING btree ("order");
  CREATE INDEX "discussions_rels_parent_idx" ON "discussions_rels" USING btree ("parent_id");
  CREATE INDEX "discussions_rels_path_idx" ON "discussions_rels" USING btree ("path");
  CREATE INDEX "discussions_rels_papers_id_idx" ON "discussions_rels" USING btree ("papers_id");
  CREATE INDEX "discussions_rels_articles_id_idx" ON "discussions_rels" USING btree ("articles_id");
  CREATE INDEX "discussions_rels_tools_id_idx" ON "discussions_rels" USING btree ("tools_id");
  CREATE INDEX "discussions_rels_newsletter_issues_id_idx" ON "discussions_rels" USING btree ("newsletter_issues_id");
  CREATE INDEX "discussions_rels_wiki_entries_id_idx" ON "discussions_rels" USING btree ("wiki_entries_id");
  CREATE INDEX "asset_versions_changed_by_idx" ON "asset_versions" USING btree ("changed_by_id");
  CREATE INDEX "asset_versions_updated_at_idx" ON "asset_versions" USING btree ("updated_at");
  CREATE INDEX "asset_versions_created_at_idx" ON "asset_versions" USING btree ("created_at");
  CREATE INDEX "asset_versions_rels_order_idx" ON "asset_versions_rels" USING btree ("order");
  CREATE INDEX "asset_versions_rels_parent_idx" ON "asset_versions_rels" USING btree ("parent_id");
  CREATE INDEX "asset_versions_rels_path_idx" ON "asset_versions_rels" USING btree ("path");
  CREATE INDEX "asset_versions_rels_papers_id_idx" ON "asset_versions_rels" USING btree ("papers_id");
  CREATE INDEX "asset_versions_rels_articles_id_idx" ON "asset_versions_rels" USING btree ("articles_id");
  CREATE INDEX "asset_versions_rels_tools_id_idx" ON "asset_versions_rels" USING btree ("tools_id");
  CREATE INDEX "asset_versions_rels_newsletter_issues_id_idx" ON "asset_versions_rels" USING btree ("newsletter_issues_id");
  CREATE INDEX "asset_versions_rels_wiki_entries_id_idx" ON "asset_versions_rels" USING btree ("wiki_entries_id");
  CREATE INDEX "asset_relationships_created_by_idx" ON "asset_relationships" USING btree ("created_by_id");
  CREATE INDEX "asset_relationships_updated_at_idx" ON "asset_relationships" USING btree ("updated_at");
  CREATE INDEX "asset_relationships_created_at_idx" ON "asset_relationships" USING btree ("created_at");
  CREATE INDEX "asset_relationships_rels_order_idx" ON "asset_relationships_rels" USING btree ("order");
  CREATE INDEX "asset_relationships_rels_parent_idx" ON "asset_relationships_rels" USING btree ("parent_id");
  CREATE INDEX "asset_relationships_rels_path_idx" ON "asset_relationships_rels" USING btree ("path");
  CREATE INDEX "asset_relationships_rels_papers_id_idx" ON "asset_relationships_rels" USING btree ("papers_id");
  CREATE INDEX "asset_relationships_rels_articles_id_idx" ON "asset_relationships_rels" USING btree ("articles_id");
  CREATE INDEX "asset_relationships_rels_tools_id_idx" ON "asset_relationships_rels" USING btree ("tools_id");
  CREATE INDEX "asset_relationships_rels_newsletter_issues_id_idx" ON "asset_relationships_rels" USING btree ("newsletter_issues_id");
  CREATE INDEX "asset_relationships_rels_wiki_entries_id_idx" ON "asset_relationships_rels" USING btree ("wiki_entries_id");
  CREATE INDEX "asset_contributions_contributor_idx" ON "asset_contributions" USING btree ("contributor_id");
  CREATE INDEX "asset_contributions_updated_at_idx" ON "asset_contributions" USING btree ("updated_at");
  CREATE INDEX "asset_contributions_created_at_idx" ON "asset_contributions" USING btree ("created_at");
  CREATE INDEX "asset_contributions_rels_order_idx" ON "asset_contributions_rels" USING btree ("order");
  CREATE INDEX "asset_contributions_rels_parent_idx" ON "asset_contributions_rels" USING btree ("parent_id");
  CREATE INDEX "asset_contributions_rels_path_idx" ON "asset_contributions_rels" USING btree ("path");
  CREATE INDEX "asset_contributions_rels_papers_id_idx" ON "asset_contributions_rels" USING btree ("papers_id");
  CREATE INDEX "asset_contributions_rels_articles_id_idx" ON "asset_contributions_rels" USING btree ("articles_id");
  CREATE INDEX "asset_contributions_rels_tools_id_idx" ON "asset_contributions_rels" USING btree ("tools_id");
  CREATE INDEX "asset_contributions_rels_newsletter_issues_id_idx" ON "asset_contributions_rels" USING btree ("newsletter_issues_id");
  CREATE INDEX "asset_contributions_rels_wiki_entries_id_idx" ON "asset_contributions_rels" USING btree ("wiki_entries_id");
  CREATE INDEX "reactions_member_idx" ON "reactions" USING btree ("member_id");
  CREATE INDEX "reactions_updated_at_idx" ON "reactions" USING btree ("updated_at");
  CREATE INDEX "reactions_created_at_idx" ON "reactions" USING btree ("created_at");
  CREATE INDEX "reactions_rels_order_idx" ON "reactions_rels" USING btree ("order");
  CREATE INDEX "reactions_rels_parent_idx" ON "reactions_rels" USING btree ("parent_id");
  CREATE INDEX "reactions_rels_path_idx" ON "reactions_rels" USING btree ("path");
  CREATE INDEX "reactions_rels_papers_id_idx" ON "reactions_rels" USING btree ("papers_id");
  CREATE INDEX "reactions_rels_articles_id_idx" ON "reactions_rels" USING btree ("articles_id");
  CREATE INDEX "reactions_rels_tools_id_idx" ON "reactions_rels" USING btree ("tools_id");
  CREATE INDEX "reactions_rels_newsletter_issues_id_idx" ON "reactions_rels" USING btree ("newsletter_issues_id");
  CREATE INDEX "reactions_rels_wiki_entries_id_idx" ON "reactions_rels" USING btree ("wiki_entries_id");
  CREATE INDEX "reactions_rels_discussions_id_idx" ON "reactions_rels" USING btree ("discussions_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_papers_fk" FOREIGN KEY ("papers_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tools_fk" FOREIGN KEY ("tools_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_newsletter_issues_fk" FOREIGN KEY ("newsletter_issues_id") REFERENCES "public"."newsletter_issues"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wiki_entries_fk" FOREIGN KEY ("wiki_entries_id") REFERENCES "public"."wiki_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_discussions_fk" FOREIGN KEY ("discussions_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_asset_versions_fk" FOREIGN KEY ("asset_versions_id") REFERENCES "public"."asset_versions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_asset_relationships_fk" FOREIGN KEY ("asset_relationships_id") REFERENCES "public"."asset_relationships"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_asset_contributions_fk" FOREIGN KEY ("asset_contributions_id") REFERENCES "public"."asset_contributions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reactions_fk" FOREIGN KEY ("reactions_id") REFERENCES "public"."reactions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_topics_id_idx" ON "payload_locked_documents_rels" USING btree ("topics_id");
  CREATE INDEX "payload_locked_documents_rels_papers_id_idx" ON "payload_locked_documents_rels" USING btree ("papers_id");
  CREATE INDEX "payload_locked_documents_rels_articles_id_idx" ON "payload_locked_documents_rels" USING btree ("articles_id");
  CREATE INDEX "payload_locked_documents_rels_tools_id_idx" ON "payload_locked_documents_rels" USING btree ("tools_id");
  CREATE INDEX "payload_locked_documents_rels_newsletter_issues_id_idx" ON "payload_locked_documents_rels" USING btree ("newsletter_issues_id");
  CREATE INDEX "payload_locked_documents_rels_wiki_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("wiki_entries_id");
  CREATE INDEX "payload_locked_documents_rels_discussions_id_idx" ON "payload_locked_documents_rels" USING btree ("discussions_id");
  CREATE INDEX "payload_locked_documents_rels_asset_versions_id_idx" ON "payload_locked_documents_rels" USING btree ("asset_versions_id");
  CREATE INDEX "payload_locked_documents_rels_asset_relationships_id_idx" ON "payload_locked_documents_rels" USING btree ("asset_relationships_id");
  CREATE INDEX "payload_locked_documents_rels_asset_contributions_id_idx" ON "payload_locked_documents_rels" USING btree ("asset_contributions_id");
  CREATE INDEX "payload_locked_documents_rels_reactions_id_idx" ON "payload_locked_documents_rels" USING btree ("reactions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "topics" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "papers_authors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "papers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "papers_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "articles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "articles_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tools" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tools_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletter_issues" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletter_issues_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "wiki_entries_defined_terms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "wiki_entries_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "wiki_entries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "wiki_entries_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "discussions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "discussions_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "asset_versions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "asset_versions_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "asset_relationships" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "asset_relationships_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "asset_contributions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "asset_contributions_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reactions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reactions_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "topics" CASCADE;
  DROP TABLE "papers_authors" CASCADE;
  DROP TABLE "papers" CASCADE;
  DROP TABLE "papers_rels" CASCADE;
  DROP TABLE "articles" CASCADE;
  DROP TABLE "articles_rels" CASCADE;
  DROP TABLE "tools" CASCADE;
  DROP TABLE "tools_rels" CASCADE;
  DROP TABLE "newsletter_issues" CASCADE;
  DROP TABLE "newsletter_issues_rels" CASCADE;
  DROP TABLE "wiki_entries_defined_terms" CASCADE;
  DROP TABLE "wiki_entries_sources" CASCADE;
  DROP TABLE "wiki_entries" CASCADE;
  DROP TABLE "wiki_entries_rels" CASCADE;
  DROP TABLE "discussions" CASCADE;
  DROP TABLE "discussions_rels" CASCADE;
  DROP TABLE "asset_versions" CASCADE;
  DROP TABLE "asset_versions_rels" CASCADE;
  DROP TABLE "asset_relationships" CASCADE;
  DROP TABLE "asset_relationships_rels" CASCADE;
  DROP TABLE "asset_contributions" CASCADE;
  DROP TABLE "asset_contributions_rels" CASCADE;
  DROP TABLE "reactions" CASCADE;
  DROP TABLE "reactions_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_topics_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_papers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_articles_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tools_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_newsletter_issues_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_wiki_entries_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_discussions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_asset_versions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_asset_relationships_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_asset_contributions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_reactions_fk";
  
  DROP INDEX "payload_locked_documents_rels_topics_id_idx";
  DROP INDEX "payload_locked_documents_rels_papers_id_idx";
  DROP INDEX "payload_locked_documents_rels_articles_id_idx";
  DROP INDEX "payload_locked_documents_rels_tools_id_idx";
  DROP INDEX "payload_locked_documents_rels_newsletter_issues_id_idx";
  DROP INDEX "payload_locked_documents_rels_wiki_entries_id_idx";
  DROP INDEX "payload_locked_documents_rels_discussions_id_idx";
  DROP INDEX "payload_locked_documents_rels_asset_versions_id_idx";
  DROP INDEX "payload_locked_documents_rels_asset_relationships_id_idx";
  DROP INDEX "payload_locked_documents_rels_asset_contributions_id_idx";
  DROP INDEX "payload_locked_documents_rels_reactions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "topics_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "papers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "articles_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tools_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "newsletter_issues_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "wiki_entries_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "discussions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "asset_versions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "asset_relationships_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "asset_contributions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reactions_id";
  DROP TYPE "public"."enum_papers_status";
  DROP TYPE "public"."enum_papers_tier";
  DROP TYPE "public"."enum_papers_source_type";
  DROP TYPE "public"."enum_articles_status";
  DROP TYPE "public"."enum_articles_tier";
  DROP TYPE "public"."enum_tools_status";
  DROP TYPE "public"."enum_tools_tier";
  DROP TYPE "public"."enum_tools_category";
  DROP TYPE "public"."enum_newsletter_issues_status";
  DROP TYPE "public"."enum_newsletter_issues_tier";
  DROP TYPE "public"."enum_wiki_entries_status";
  DROP TYPE "public"."enum_wiki_entries_tier";
  DROP TYPE "public"."enum_wiki_entries_category";
  DROP TYPE "public"."enum_asset_versions_change_type";
  DROP TYPE "public"."enum_asset_relationships_relationship_type";
  DROP TYPE "public"."enum_asset_contributions_contribution_type";
  DROP TYPE "public"."enum_reactions_type";`)
}
