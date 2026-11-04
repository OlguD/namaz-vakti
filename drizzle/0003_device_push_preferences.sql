ALTER TABLE "devices" ADD COLUMN "live_alerts" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "announcements" boolean DEFAULT true NOT NULL;