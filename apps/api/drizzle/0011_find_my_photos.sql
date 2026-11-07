CREATE TABLE "face_profiles" (
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"model" text NOT NULL,
	"embedding" real[] NOT NULL,
	"consented_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "face_profiles_event_id_user_id_pk" PRIMARY KEY("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "photo_faces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"model" text NOT NULL,
	"embedding" real[] NOT NULL,
	"box" real[] NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "find_my_photos" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "faces_scanned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "face_profiles" ADD CONSTRAINT "face_profiles_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "face_profiles" ADD CONSTRAINT "face_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_faces" ADD CONSTRAINT "photo_faces_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_faces" ADD CONSTRAINT "photo_faces_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photo_faces_event_idx" ON "photo_faces" USING btree ("event_id","model");--> statement-breakpoint
CREATE INDEX "photo_faces_photo_idx" ON "photo_faces" USING btree ("photo_id");