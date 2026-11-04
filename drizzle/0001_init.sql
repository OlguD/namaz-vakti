CREATE TYPE "public"."geocode_status" AS ENUM('pending', 'ok', 'not_found', 'manual');--> statement-breakpoint
CREATE TYPE "public"."prayer_times_source" AS ENUM('emushaf', 'diyanet', 'calculated');--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('ios', 'android', 'web');--> statement-breakpoint
CREATE TYPE "public"."email_token_purpose" AS ENUM('verify_email', 'reset_password');--> statement-breakpoint
CREATE TYPE "public"."identity_provider" AS ENUM('apple', 'google');--> statement-breakpoint
CREATE TYPE "public"."user_kind" AS ENUM('anonymous', 'registered');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'moderator', 'admin');--> statement-breakpoint
CREATE TYPE "public"."mosque_source" AS ENUM('osm', 'user');--> statement-breakpoint
CREATE TYPE "public"."mosque_suggestion_kind" AS ENUM('add', 'edit', 'closed');--> statement-breakpoint
CREATE TYPE "public"."mosque_suggestion_status" AS ENUM('open', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."live_category" AS ENUM('haramain', 'dua', 'quran', 'sohbet', 'other');--> statement-breakpoint
CREATE TYPE "public"."live_status" AS ENUM('live', 'upcoming', 'ended', 'none');--> statement-breakpoint
CREATE TYPE "public"."chat_report_reason" AS ENUM('spam', 'harassment', 'hate', 'sexual', 'violence', 'misinformation', 'other');--> statement-breakpoint
CREATE TYPE "public"."chat_report_status" AS ENUM('open', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TABLE "cities" (
	"id" text PRIMARY KEY NOT NULL,
	"country_id" text NOT NULL,
	"name" text NOT NULL,
	"name_en" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"districts_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_en" text NOT NULL,
	"default_timezone" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "districts" (
	"id" text PRIMARY KEY NOT NULL,
	"city_id" text NOT NULL,
	"name" text NOT NULL,
	"name_en" text NOT NULL,
	"location" geometry(Point,4326),
	"timezone" text,
	"geocode_status" "geocode_status" DEFAULT 'pending' NOT NULL,
	"geocode_attempts" integer DEFAULT 0 NOT NULL,
	"geocoded_at" timestamp with time zone,
	"last_requested_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prayer_times" (
	"district_id" text NOT NULL,
	"date" date NOT NULL,
	"imsak" text NOT NULL,
	"gunes" text NOT NULL,
	"ogle" text NOT NULL,
	"ikindi" text NOT NULL,
	"aksam" text NOT NULL,
	"yatsi" text NOT NULL,
	"sunrise" text,
	"sunset" text,
	"qibla_time" text,
	"hijri_short" text,
	"hijri_long" text,
	"moon_phase_url" text,
	"source" "prayer_times_source" NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prayer_times_district_id_date_pk" PRIMARY KEY("district_id","date")
);
--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "identity_provider" NOT NULL,
	"subject" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"installation_id" text NOT NULL,
	"platform" "device_platform" NOT NULL,
	"push_token" text,
	"locale" text,
	"app_version" text,
	"district_id" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "email_token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"rotated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "user_kind" DEFAULT 'anonymous' NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"display_name" text,
	"email" text,
	"email_verified_at" timestamp with time zone,
	"password_hash" text,
	"locale" text DEFAULT 'tr' NOT NULL,
	"district_id" text,
	"chat_muted_until" timestamp with time zone,
	"banned_until" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mosque_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "mosque_suggestion_kind" NOT NULL,
	"mosque_id" uuid,
	"user_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "mosque_suggestion_status" DEFAULT 'open' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mosque_tiles" (
	"id" text PRIMARY KEY NOT NULL,
	"imported_at" timestamp with time zone NOT NULL,
	"mosque_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mosques" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "mosque_source" NOT NULL,
	"osm_ref" text,
	"name" text,
	"name_en" text,
	"name_ar" text,
	"location" geometry(Point,4326) NOT NULL,
	"address" text,
	"website" text,
	"phone" text,
	"wheelchair" text,
	"has_women_section" boolean,
	"tags" jsonb,
	"hidden" boolean DEFAULT false NOT NULL,
	"last_seen_in_source_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"youtube_channel_id" text NOT NULL,
	"title" text NOT NULL,
	"thumbnail_url" text,
	"category" "live_category" DEFAULT 'other' NOT NULL,
	"language" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"notify_on_live" boolean DEFAULT false NOT NULL,
	"last_polled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_streams" (
	"video_id" text PRIMARY KEY NOT NULL,
	"channel_id" uuid NOT NULL,
	"title" text NOT NULL,
	"thumbnail_url" text,
	"status" "live_status" NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"scheduled_start_at" timestamp with time zone,
	"actual_start_at" timestamp with time zone,
	"actual_end_at" timestamp with time zone,
	"concurrent_viewers" integer,
	"notified_at" timestamp with time zone,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"room_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"client_message_id" text,
	"hidden_at" timestamp with time zone,
	"hidden_reason" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" bigint NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" "chat_report_reason" NOT NULL,
	"note" text,
	"status" "chat_report_status" DEFAULT 'open' NOT NULL,
	"handled_by" uuid,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"language" text,
	"slow_mode_seconds" integer DEFAULT 3 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "districts" ADD CONSTRAINT "districts_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_times" ADD CONSTRAINT "prayer_times_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mosque_suggestions" ADD CONSTRAINT "mosque_suggestions_mosque_id_mosques_id_fk" FOREIGN KEY ("mosque_id") REFERENCES "public"."mosques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mosque_suggestions" ADD CONSTRAINT "mosque_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mosque_suggestions" ADD CONSTRAINT "mosque_suggestions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_channel_id_live_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."live_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_chat_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cities_country_idx" ON "cities" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "districts_city_idx" ON "districts" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "districts_location_gix" ON "districts" USING gist ("location");--> statement-breakpoint
CREATE INDEX "districts_geocode_pending_idx" ON "districts" USING btree ("geocode_status") WHERE "districts"."geocode_status" = 'pending';--> statement-breakpoint
CREATE INDEX "prayer_times_date_idx" ON "prayer_times" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_provider_subject_unique" ON "auth_identities" USING btree ("provider","subject");--> statement-breakpoint
CREATE INDEX "auth_identities_user_idx" ON "auth_identities" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_installation_unique" ON "devices" USING btree ("installation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_push_token_unique" ON "devices" USING btree ("push_token") WHERE "devices"."push_token" is not null;--> statement-breakpoint
CREATE INDEX "devices_user_idx" ON "devices" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_tokens_hash_unique" ON "email_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_idx" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email") WHERE "users"."email" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_display_name_unique" ON "users" USING btree (lower("display_name")) WHERE "users"."display_name" is not null;--> statement-breakpoint
CREATE INDEX "mosque_suggestions_status_idx" ON "mosque_suggestions" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mosques_osm_ref_unique" ON "mosques" USING btree ("osm_ref") WHERE "mosques"."osm_ref" is not null;--> statement-breakpoint
CREATE INDEX "mosques_location_gix" ON "mosques" USING gist ("location");--> statement-breakpoint
CREATE INDEX "mosques_location_geog_gix" ON "mosques" USING gist (("location"::geography));--> statement-breakpoint
CREATE UNIQUE INDEX "live_channels_youtube_unique" ON "live_channels" USING btree ("youtube_channel_id");--> statement-breakpoint
CREATE INDEX "live_streams_status_idx" ON "live_streams" USING btree ("status");--> statement-breakpoint
CREATE INDEX "chat_messages_room_id_idx" ON "chat_messages" USING btree ("room_id","id");--> statement-breakpoint
CREATE INDEX "chat_messages_user_idx" ON "chat_messages" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_client_id_unique" ON "chat_messages" USING btree ("user_id","client_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_reports_message_reporter_unique" ON "chat_reports" USING btree ("message_id","reporter_id");--> statement-breakpoint
CREATE INDEX "chat_reports_status_idx" ON "chat_reports" USING btree ("status","created_at");