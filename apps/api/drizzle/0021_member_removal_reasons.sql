CREATE TYPE "public"."removal_reason" AS ENUM('objectionable', 'harassment', 'spam', 'uninvited', 'other');--> statement-breakpoint
ALTER TABLE "event_members" ADD COLUMN "banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_members" ADD COLUMN "removed_reason" "removal_reason";--> statement-breakpoint
ALTER TABLE "event_members" ADD COLUMN "removed_note" text;--> statement-breakpoint
-- Removals before this were permanent: keep those people out.
UPDATE "event_members" SET "banned" = true WHERE "status" = 'removed';