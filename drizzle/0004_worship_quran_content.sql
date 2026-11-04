CREATE TYPE "public"."prayer_status" AS ENUM('prayed', 'jamaah', 'qada');--> statement-breakpoint
CREATE TYPE "public"."vakit" AS ENUM('sabah', 'ogle', 'ikindi', 'aksam', 'yatsi');--> statement-breakpoint
CREATE TYPE "public"."hatim_member_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."juz_status" AS ENUM('open', 'taken', 'read');--> statement-breakpoint
CREATE TABLE "custom_dhikrs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"arabic" text,
	"transliteration" text NOT NULL,
	"meaning" text,
	"target" integer DEFAULT 33 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_dhikrs_target_range" CHECK ("custom_dhikrs"."target" BETWEEN 1 AND 100000)
);
--> statement-breakpoint
CREATE TABLE "dhikr_counts" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"dhikr_key" text NOT NULL,
	"count" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dhikr_counts_user_id_date_dhikr_key_pk" PRIMARY KEY("user_id","date","dhikr_key"),
	CONSTRAINT "dhikr_counts_non_negative" CHECK ("dhikr_counts"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "prayer_logs" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"vakit" "vakit" NOT NULL,
	"status" "prayer_status" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prayer_logs_user_id_date_vakit_pk" PRIMARY KEY("user_id","date","vakit")
);
--> statement-breakpoint
CREATE TABLE "qada_debts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"sabah" integer DEFAULT 0 NOT NULL,
	"ogle" integer DEFAULT 0 NOT NULL,
	"ikindi" integer DEFAULT 0 NOT NULL,
	"aksam" integer DEFAULT 0 NOT NULL,
	"yatsi" integer DEFAULT 0 NOT NULL,
	"vitir" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qada_debts_non_negative" CHECK ("qada_debts"."sabah" >= 0 AND "qada_debts"."ogle" >= 0 AND "qada_debts"."ikindi" >= 0 AND "qada_debts"."aksam" >= 0 AND "qada_debts"."yatsi" >= 0 AND "qada_debts"."vitir" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sync_batches" (
	"user_id" uuid NOT NULL,
	"batch_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_batches_user_id_batch_id_pk" PRIMARY KEY("user_id","batch_id")
);
--> statement-breakpoint
CREATE TABLE "group_hatim_juz" (
	"hatim_id" uuid NOT NULL,
	"juz" smallint NOT NULL,
	"status" "juz_status" DEFAULT 'open' NOT NULL,
	"user_id" uuid,
	"taken_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	CONSTRAINT "group_hatim_juz_hatim_id_juz_pk" PRIMARY KEY("hatim_id","juz"),
	CONSTRAINT "group_hatim_juz_range" CHECK ("group_hatim_juz"."juz" BETWEEN 1 AND 30)
);
--> statement-breakpoint
CREATE TABLE "group_hatim_members" (
	"hatim_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "hatim_member_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_hatim_members_hatim_id_user_id_pk" PRIMARY KEY("hatim_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "group_hatims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"invite_code" text NOT NULL,
	"target_date" date,
	"round" integer DEFAULT 1 NOT NULL,
	"completed_rounds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quran_progress" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"juz" smallint DEFAULT 0 NOT NULL,
	"page" smallint DEFAULT 0 NOT NULL,
	"completed_khatms" integer DEFAULT 0 NOT NULL,
	"target_date" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quran_progress_juz_range" CHECK ("quran_progress"."juz" BETWEEN 0 AND 30),
	CONSTRAINT "quran_progress_page_range" CHECK ("quran_progress"."page" BETWEEN 0 AND 19)
);
--> statement-breakpoint
CREATE TABLE "quran_reading_days" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"pages" integer NOT NULL,
	CONSTRAINT "quran_reading_days_user_id_date_pk" PRIMARY KEY("user_id","date"),
	CONSTRAINT "quran_reading_days_pages" CHECK ("quran_reading_days"."pages" >= 0)
);
--> statement-breakpoint
CREATE TABLE "dua_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name_tr" text NOT NULL,
	"name_en" text,
	"name_ar" text,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "duas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"category_id" text NOT NULL,
	"title" text NOT NULL,
	"arabic" text NOT NULL,
	"transliteration" text,
	"meaning_tr" text NOT NULL,
	"meaning_en" text,
	"source" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esma" (
	"no" smallint PRIMARY KEY NOT NULL,
	"arabic" text NOT NULL,
	"transliteration" text NOT NULL,
	"meaning_tr" text,
	"meaning_en" text,
	CONSTRAINT "esma_no_range" CHECK ("esma"."no" BETWEEN 1 AND 99)
);
--> statement-breakpoint
CREATE TABLE "religious_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"key" text NOT NULL,
	"name_tr" text NOT NULL,
	"name_en" text,
	"hijri" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zakat_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"gold_gram_price" numeric(14, 2),
	"silver_gram_price" numeric(14, 2),
	"gold_nisab_grams" numeric(8, 2) DEFAULT '80.18' NOT NULL,
	"silver_nisab_grams" numeric(8, 2) DEFAULT '561' NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zakat_settings_single_row" CHECK ("zakat_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "custom_dhikrs" ADD CONSTRAINT "custom_dhikrs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dhikr_counts" ADD CONSTRAINT "dhikr_counts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_logs" ADD CONSTRAINT "prayer_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qada_debts" ADD CONSTRAINT "qada_debts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_batches" ADD CONSTRAINT "sync_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_hatim_juz" ADD CONSTRAINT "group_hatim_juz_hatim_id_group_hatims_id_fk" FOREIGN KEY ("hatim_id") REFERENCES "public"."group_hatims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_hatim_juz" ADD CONSTRAINT "group_hatim_juz_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_hatim_members" ADD CONSTRAINT "group_hatim_members_hatim_id_group_hatims_id_fk" FOREIGN KEY ("hatim_id") REFERENCES "public"."group_hatims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_hatim_members" ADD CONSTRAINT "group_hatim_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_hatims" ADD CONSTRAINT "group_hatims_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quran_progress" ADD CONSTRAINT "quran_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quran_reading_days" ADD CONSTRAINT "quran_reading_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duas" ADD CONSTRAINT "duas_category_id_dua_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."dua_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zakat_settings" ADD CONSTRAINT "zakat_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_dhikrs_user_idx" ON "custom_dhikrs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sync_batches_created_idx" ON "sync_batches" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "group_hatim_juz_user_idx" ON "group_hatim_juz" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "group_hatim_members_user_idx" ON "group_hatim_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_hatims_invite_unique" ON "group_hatims" USING btree ("invite_code");--> statement-breakpoint
CREATE UNIQUE INDEX "duas_key_unique" ON "duas" USING btree ("key");--> statement-breakpoint
CREATE INDEX "duas_category_idx" ON "duas" USING btree ("category_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "religious_days_date_key_unique" ON "religious_days" USING btree ("date","key");--> statement-breakpoint
CREATE INDEX "religious_days_date_idx" ON "religious_days" USING btree ("date");