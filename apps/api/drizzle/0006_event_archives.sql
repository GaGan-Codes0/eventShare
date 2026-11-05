CREATE TYPE "public"."archive_scope" AS ENUM('all', 'photographers', 'guests');--> statement-breakpoint
CREATE TYPE "public"."archive_status" AS ENUM('building', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "event_archives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"scope" "archive_scope" NOT NULL,
	"status" "archive_status" DEFAULT 'building' NOT NULL,
	"key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"photo_count" integer NOT NULL,
	"byte_size" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_archives" ADD CONSTRAINT "event_archives_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_archives_event_scope_idx" ON "event_archives" USING btree ("event_id","scope");