CREATE TYPE "public"."content_source" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TYPE "public"."hijri_month_source" AS ENUM('diyanet_tables', 'aladhan_diyanet');--> statement-breakpoint
CREATE TABLE "hijri_months" (
	"hijri_year" integer NOT NULL,
	"month" smallint NOT NULL,
	"start_date" date NOT NULL,
	"length" smallint,
	"source" "hijri_month_source" NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"conflict" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hijri_months_hijri_year_month_pk" PRIMARY KEY("hijri_year","month"),
	CONSTRAINT "hijri_months_month_range" CHECK ("hijri_months"."month" BETWEEN 1 AND 12)
);
--> statement-breakpoint
CREATE TABLE "metal_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"usd_try" numeric(14, 4) NOT NULL,
	"gold_usd_ounce" numeric(14, 4) NOT NULL,
	"silver_usd_ounce" numeric(14, 4) NOT NULL,
	"gold_gram_price" numeric(14, 2) NOT NULL,
	"silver_gram_price" numeric(14, 2) NOT NULL,
	"fx_date" date
);
--> statement-breakpoint
DROP INDEX "religious_days_date_key_unique";--> statement-breakpoint
ALTER TABLE "religious_days" ADD COLUMN "hijri_year" integer;--> statement-breakpoint
-- Backfill rows imported before this column existed with an approximate hijri
-- year (mean year length 354.367 days since 16 July 622); then require it.
UPDATE "religious_days" SET "hijri_year" = floor(("date" - DATE '0622-07-16') / 354.36707)::int + 1 WHERE "hijri_year" IS NULL;--> statement-breakpoint
ALTER TABLE "religious_days" ALTER COLUMN "hijri_year" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "religious_days" ADD COLUMN "source" "content_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "religious_days" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "zakat_settings" ADD COLUMN "usd_try" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "zakat_settings" ADD COLUMN "source" "content_source" DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "zakat_settings" ADD COLUMN "fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "zakat_settings" ADD COLUMN "last_error" text;--> statement-breakpoint
CREATE INDEX "metal_price_history_fetched_idx" ON "metal_price_history" USING btree ("fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "religious_days_key_year_unique" ON "religious_days" USING btree ("key","hijri_year");