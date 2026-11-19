CREATE TYPE "public"."event_plan" AS ENUM('free', 'party', 'celebration', 'branded');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "plan" "event_plan" DEFAULT 'free' NOT NULL;--> statement-breakpoint
-- Events made before packages keep everything they could already do.
UPDATE "events" SET "plan" = 'branded';
