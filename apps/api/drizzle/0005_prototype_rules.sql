CREATE TYPE "public"."event_type" AS ENUM('wedding', 'corporate', 'birthday', 'other');--> statement-breakpoint
CREATE TYPE "public"."photo_filter" AS ENUM('natural', 'golden', 'mono', 'faded');--> statement-breakpoint
CREATE TYPE "public"."reveal_mode" AS ENUM('live', 'after', 'morning');--> statement-breakpoint
CREATE TABLE "photo_likes" (
	"photo_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_likes_photo_id_user_id_pk" PRIMARY KEY("photo_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "events_guest_photo_limit_check";--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "guest_photo_limit" SET DEFAULT 36;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "guest_photo_limit" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "type" "event_type" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "partner1" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "partner2" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "joiner" text DEFAULT '&' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "organizer" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "reveal_mode" "reveal_mode" DEFAULT 'live' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "album_opens_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "require_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "allow_downloads" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "allow_library_uploads" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "date_stamp" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "filter" "photo_filter" DEFAULT 'natural' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "prompts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "pending_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "prompt" text;--> statement-breakpoint
ALTER TABLE "photo_likes" ADD CONSTRAINT "photo_likes_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_likes" ADD CONSTRAINT "photo_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_joiner_check" CHECK ("events"."joiner" IN ('&', 'and', '+'));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_guest_photo_limit_check" CHECK ("events"."guest_photo_limit" IS NULL OR "events"."guest_photo_limit" IN (10, 24, 36, 50, 20, 40, 60));--> statement-breakpoint
-- Saved themes move to the new set: closest preset, `color` becomes `accent` (purple and charcoal
-- keep their colour as an accent), "elegant" fonts become "editorial".
UPDATE "events" SET "theme" = jsonb_build_object(
  'preset', CASE "theme"->>'preset'
    WHEN 'rose' THEN 'blush' WHEN 'plum' THEN 'blush' WHEN 'marigold' THEN 'marigold'
    WHEN 'terracotta' THEN 'marigold' WHEN 'ocean' THEN 'navy' ELSE 'sage' END,
  'accent', COALESCE(NULLIF("theme"->'color', 'null'::jsonb), CASE "theme"->>'preset'
    WHEN 'plum' THEN '"#5B4A9E"'::jsonb WHEN 'charcoal' THEN '"#2A2A2A"'::jsonb ELSE 'null'::jsonb END),
  'fonts', CASE "theme"->>'fonts' WHEN 'elegant' THEN 'editorial' ELSE COALESCE("theme"->>'fonts', 'classic') END,
  'frame', COALESCE("theme"->'frame', '"none"'::jsonb)
) WHERE "theme" IS NOT NULL AND "theme" ? 'color';
