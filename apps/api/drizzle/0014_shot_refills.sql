CREATE TYPE "public"."refill_status" AS ENUM('pending', 'approved', 'declined');--> statement-breakpoint
CREATE TABLE "shot_refill_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "refill_status" DEFAULT 'pending' NOT NULL,
	"shots" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "event_members" ADD COLUMN "bonus_shots" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shot_refill_requests" ADD CONSTRAINT "shot_refill_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shot_refill_requests" ADD CONSTRAINT "shot_refill_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "refill_open_uidx" ON "shot_refill_requests" USING btree ("event_id","user_id") WHERE "shot_refill_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "refill_event_status_idx" ON "shot_refill_requests" USING btree ("event_id","status");