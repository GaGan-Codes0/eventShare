CREATE TYPE "public"."media_kind" AS ENUM('photo', 'video', 'voice');--> statement-breakpoint
ALTER TABLE "photos" ALTER COLUMN "thumb_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "event_members" ADD COLUMN "video_ms_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_members" ADD COLUMN "voice_ms_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "kind" "media_kind" DEFAULT 'photo' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "duration_ms" integer;