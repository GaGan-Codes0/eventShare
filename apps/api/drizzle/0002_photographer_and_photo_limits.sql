ALTER TYPE "public"."member_role" ADD VALUE 'photographer' BEFORE 'member';--> statement-breakpoint
ALTER TABLE "event_members" ADD COLUMN "photos_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "guest_photo_limit" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_guest_photo_limit_check" CHECK ("events"."guest_photo_limit" IN (20, 40, 60));--> statement-breakpoint
-- Count photos people uploaded before limits existed, so their allowance starts from the right place.
UPDATE "event_members" m SET "photos_used" = p.n
FROM (SELECT "event_id", "uploader_id", count(*)::int AS n FROM "photos" GROUP BY 1, 2) p
WHERE m."event_id" = p."event_id" AND m."user_id" = p."uploader_id";
