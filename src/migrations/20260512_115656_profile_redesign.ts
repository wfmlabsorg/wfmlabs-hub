import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_members_workforce_types" AS ENUM('contact-center', 'back-office', 'field-service', 'consultant-advisory', 'other');
  CREATE TYPE "public"."enum_members_ovix_profile_client_industries" AS ENUM('finance', 'insurance', 'healthcare', 'telecom', 'retail', 'technology', 'government', 'energy-utilities', 'transportation-logistics', 'manufacturing', 'education', 'media-entertainment', 'hospitality-travel', 'other');
  CREATE TYPE "public"."enum_members_ovix_profile_workforce_footprint_sourcing" AS ENUM('in-house', 'bpo-vendor');
  CREATE TYPE "public"."enum_members_ovix_profile_workforce_footprint_workforce_type" AS ENUM('contact-center', 'back-office', 'other');
  CREATE TYPE "public"."enum_members_ovix_profile_customer_geography_us_regions" AS ENUM('northeast', 'southeast', 'midwest', 'southwest', 'west-coast');
  CREATE TYPE "public"."enum_members_role" AS ENUM('admin', 'moderator', 'member');
  CREATE TYPE "public"."enum_members_industry" AS ENUM('finance', 'insurance', 'healthcare', 'telecom', 'retail', 'technology', 'government', 'energy-utilities', 'transportation-logistics', 'manufacturing', 'education', 'media-entertainment', 'hospitality-travel', 'other');
  CREATE TYPE "public"."enum_members_ovix_profile_customer_geography_scope" AS ENUM('single-state', 'regional-us', 'national-us', 'us-plus-neighbors', 'eu', 'international');
  CREATE TYPE "public"."enum_members_ovix_profile_customer_geography_us_state" AS ENUM('AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR');
  CREATE TABLE "members_workforce_types" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_members_workforce_types",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "members_ovix_profile_client_industries" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_members_ovix_profile_client_industries",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "members_ovix_profile_workforce_footprint" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"city" varchar,
  	"state_province" varchar,
  	"country" varchar DEFAULT 'US',
  	"headcount" numeric,
  	"sourcing" "enum_members_ovix_profile_workforce_footprint_sourcing",
  	"workforce_type" "enum_members_ovix_profile_workforce_footprint_workforce_type"
  );
  
  CREATE TABLE "members_ovix_profile_customer_geography_us_regions" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_members_ovix_profile_customer_geography_us_regions",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "members_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"topics_id" integer
  );
  
  ALTER TABLE "members" ALTER COLUMN "type" SET DATA TYPE text;
  ALTER TABLE "members" ALTER COLUMN "type" SET DEFAULT 'human'::text;
  DROP TYPE "public"."enum_members_type";
  CREATE TYPE "public"."enum_members_type" AS ENUM('human', 'agent');
  ALTER TABLE "members" ALTER COLUMN "type" SET DEFAULT 'human'::"public"."enum_members_type";
  ALTER TABLE "members" ALTER COLUMN "type" SET DATA TYPE "public"."enum_members_type" USING "type"::"public"."enum_members_type";
  ALTER TABLE "members" ADD COLUMN "role" "enum_members_role" DEFAULT 'member' NOT NULL;
  ALTER TABLE "members" ADD COLUMN "industry" "enum_members_industry";
  ALTER TABLE "members" ADD COLUMN "profile_title" varchar;
  ALTER TABLE "members" ADD COLUMN "profile_company" varchar;
  ALTER TABLE "members" ADD COLUMN "profile_location" varchar;
  ALTER TABLE "members" ADD COLUMN "profile_linkedin_url" varchar;
  ALTER TABLE "members" ADD COLUMN "profile_github_username" varchar;
  ALTER TABLE "members" ADD COLUMN "profile_website_url" varchar;
  ALTER TABLE "members" ADD COLUMN "agent_metadata_tagline" varchar;
  ALTER TABLE "members" ADD COLUMN "agent_metadata_agent_role" varchar;
  ALTER TABLE "members" ADD COLUMN "agent_metadata_mcp_endpoint" varchar;
  ALTER TABLE "members" ADD COLUMN "agent_metadata_a2a_card_url" varchar;
  ALTER TABLE "members" ADD COLUMN "ovix_profile_is_ovix_contributor" boolean DEFAULT false;
  ALTER TABLE "members" ADD COLUMN "ovix_profile_is_bpo" boolean DEFAULT false;
  ALTER TABLE "members" ADD COLUMN "ovix_profile_customer_geography_scope" "enum_members_ovix_profile_customer_geography_scope";
  ALTER TABLE "members" ADD COLUMN "ovix_profile_customer_geography_us_state" "enum_members_ovix_profile_customer_geography_us_state";
  ALTER TABLE "members" ADD COLUMN "ovix_profile_customer_geography_eu_countries" varchar;
  ALTER TABLE "members" ADD COLUMN "ovix_profile_customer_geography_international_regions" varchar;
  ALTER TABLE "members" ADD COLUMN "visibility_show_professional" boolean DEFAULT true;
  ALTER TABLE "members" ADD COLUMN "visibility_show_industry" boolean DEFAULT true;
  ALTER TABLE "members" ADD COLUMN "visibility_show_bio" boolean DEFAULT true;
  ALTER TABLE "members" ADD COLUMN "visibility_show_links" boolean DEFAULT true;
  ALTER TABLE "members" ADD COLUMN "visibility_show_in_directory" boolean DEFAULT true;
  ALTER TABLE "members" ADD COLUMN "visibility_show_email" boolean DEFAULT false;
  ALTER TABLE "members" ADD COLUMN "visibility_show_ovix_data" boolean DEFAULT false;
  ALTER TABLE "members" ADD COLUMN "roc_user_id" numeric;
  ALTER TABLE "members_workforce_types" ADD CONSTRAINT "members_workforce_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "members_ovix_profile_client_industries" ADD CONSTRAINT "members_ovix_profile_client_industries_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "members_ovix_profile_workforce_footprint" ADD CONSTRAINT "members_ovix_profile_workforce_footprint_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "members_ovix_profile_customer_geography_us_regions" ADD CONSTRAINT "members_ovix_profile_customer_geography_us_regions_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "members_rels" ADD CONSTRAINT "members_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "members_rels" ADD CONSTRAINT "members_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "members_workforce_types_order_idx" ON "members_workforce_types" USING btree ("order");
  CREATE INDEX "members_workforce_types_parent_idx" ON "members_workforce_types" USING btree ("parent_id");
  CREATE INDEX "members_ovix_profile_client_industries_order_idx" ON "members_ovix_profile_client_industries" USING btree ("order");
  CREATE INDEX "members_ovix_profile_client_industries_parent_idx" ON "members_ovix_profile_client_industries" USING btree ("parent_id");
  CREATE INDEX "members_ovix_profile_workforce_footprint_order_idx" ON "members_ovix_profile_workforce_footprint" USING btree ("_order");
  CREATE INDEX "members_ovix_profile_workforce_footprint_parent_id_idx" ON "members_ovix_profile_workforce_footprint" USING btree ("_parent_id");
  CREATE INDEX "members_ovix_profile_customer_geography_us_regions_order_idx" ON "members_ovix_profile_customer_geography_us_regions" USING btree ("order");
  CREATE INDEX "members_ovix_profile_customer_geography_us_regions_parent_idx" ON "members_ovix_profile_customer_geography_us_regions" USING btree ("parent_id");
  CREATE INDEX "members_rels_order_idx" ON "members_rels" USING btree ("order");
  CREATE INDEX "members_rels_parent_idx" ON "members_rels" USING btree ("parent_id");
  CREATE INDEX "members_rels_path_idx" ON "members_rels" USING btree ("path");
  CREATE INDEX "members_rels_topics_id_idx" ON "members_rels" USING btree ("topics_id");
  CREATE INDEX "members_roc_user_id_idx" ON "members" USING btree ("roc_user_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_members_type" ADD VALUE 'admin';
  ALTER TABLE "members_workforce_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "members_ovix_profile_client_industries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "members_ovix_profile_workforce_footprint" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "members_ovix_profile_customer_geography_us_regions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "members_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "members_workforce_types" CASCADE;
  DROP TABLE "members_ovix_profile_client_industries" CASCADE;
  DROP TABLE "members_ovix_profile_workforce_footprint" CASCADE;
  DROP TABLE "members_ovix_profile_customer_geography_us_regions" CASCADE;
  DROP TABLE "members_rels" CASCADE;
  DROP INDEX "members_roc_user_id_idx";
  ALTER TABLE "members" DROP COLUMN "role";
  ALTER TABLE "members" DROP COLUMN "industry";
  ALTER TABLE "members" DROP COLUMN "profile_title";
  ALTER TABLE "members" DROP COLUMN "profile_company";
  ALTER TABLE "members" DROP COLUMN "profile_location";
  ALTER TABLE "members" DROP COLUMN "profile_linkedin_url";
  ALTER TABLE "members" DROP COLUMN "profile_github_username";
  ALTER TABLE "members" DROP COLUMN "profile_website_url";
  ALTER TABLE "members" DROP COLUMN "agent_metadata_tagline";
  ALTER TABLE "members" DROP COLUMN "agent_metadata_agent_role";
  ALTER TABLE "members" DROP COLUMN "agent_metadata_mcp_endpoint";
  ALTER TABLE "members" DROP COLUMN "agent_metadata_a2a_card_url";
  ALTER TABLE "members" DROP COLUMN "ovix_profile_is_ovix_contributor";
  ALTER TABLE "members" DROP COLUMN "ovix_profile_is_bpo";
  ALTER TABLE "members" DROP COLUMN "ovix_profile_customer_geography_scope";
  ALTER TABLE "members" DROP COLUMN "ovix_profile_customer_geography_us_state";
  ALTER TABLE "members" DROP COLUMN "ovix_profile_customer_geography_eu_countries";
  ALTER TABLE "members" DROP COLUMN "ovix_profile_customer_geography_international_regions";
  ALTER TABLE "members" DROP COLUMN "visibility_show_professional";
  ALTER TABLE "members" DROP COLUMN "visibility_show_industry";
  ALTER TABLE "members" DROP COLUMN "visibility_show_bio";
  ALTER TABLE "members" DROP COLUMN "visibility_show_links";
  ALTER TABLE "members" DROP COLUMN "visibility_show_in_directory";
  ALTER TABLE "members" DROP COLUMN "visibility_show_email";
  ALTER TABLE "members" DROP COLUMN "visibility_show_ovix_data";
  ALTER TABLE "members" DROP COLUMN "roc_user_id";
  DROP TYPE "public"."enum_members_workforce_types";
  DROP TYPE "public"."enum_members_ovix_profile_client_industries";
  DROP TYPE "public"."enum_members_ovix_profile_workforce_footprint_sourcing";
  DROP TYPE "public"."enum_members_ovix_profile_workforce_footprint_workforce_type";
  DROP TYPE "public"."enum_members_ovix_profile_customer_geography_us_regions";
  DROP TYPE "public"."enum_members_role";
  DROP TYPE "public"."enum_members_industry";
  DROP TYPE "public"."enum_members_ovix_profile_customer_geography_scope";
  DROP TYPE "public"."enum_members_ovix_profile_customer_geography_us_state";`)
}
