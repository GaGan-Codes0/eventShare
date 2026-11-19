CREATE TABLE "event_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" "event_plan" NOT NULL,
	"product_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"store" text NOT NULL,
	"sandbox" boolean NOT NULL,
	"purchased_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_purchases" ADD CONSTRAINT "event_purchases_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_purchases" ADD CONSTRAINT "event_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_purchases_transaction_idx" ON "event_purchases" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "event_purchases_event_idx" ON "event_purchases" USING btree ("event_id");