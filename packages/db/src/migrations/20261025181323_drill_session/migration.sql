CREATE TABLE "drill_session" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"drill" text NOT NULL,
	"level" smallint NOT NULL,
	"correct" smallint NOT NULL,
	"total" smallint NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drill_session_drill_check" CHECK ("drill" in ('square_colour', 'coordinates', 'diagonals', 'knight_distance')),
	CONSTRAINT "drill_session_level_check" CHECK ("level" >= 1),
	CONSTRAINT "drill_session_score_check" CHECK ("total" >= 1 and "correct" >= 0 and "correct" <= "total"),
	CONSTRAINT "drill_session_duration_check" CHECK ("duration_ms" >= 0)
);
--> statement-breakpoint
CREATE INDEX "drillSession_userId_drill_createdAt_idx" ON "drill_session" ("user_id","drill","created_at");--> statement-breakpoint
ALTER TABLE "drill_session" ADD CONSTRAINT "drill_session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;