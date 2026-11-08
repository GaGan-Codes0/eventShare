CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "face_profiles" ALTER COLUMN "embedding" SET DATA TYPE vector(128) USING "embedding"::vector(128);--> statement-breakpoint
ALTER TABLE "photo_faces" ALTER COLUMN "embedding" SET DATA TYPE vector(128) USING "embedding"::vector(128);
