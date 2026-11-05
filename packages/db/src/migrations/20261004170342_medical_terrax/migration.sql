CREATE TYPE "analysis_status" AS ENUM('pending', 'screening', 'confirming', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "game_result" AS ENUM('1-0', '0-1', '1/2-1/2', '*');--> statement-breakpoint
CREATE TYPE "phase" AS ENUM('opening', 'middlegame', 'endgame');--> statement-breakpoint
CREATE TYPE "severity" AS ENUM('inaccuracy', 'mistake', 'blunder');--> statement-breakpoint
CREATE TYPE "user_color" AS ENUM('white', 'black');--> statement-breakpoint
CREATE TYPE "lichess_import_state" AS ENUM('idle', 'running', 'backoff', 'failed');--> statement-breakpoint
CREATE TABLE "card" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"mistake_id" text UNIQUE,
	"due" timestamp with time zone NOT NULL,
	"stability" real,
	"difficulty" real,
	"elapsed_days" integer,
	"scheduled_days" integer,
	"learning_steps" integer,
	"reps" integer,
	"lapses" integer,
	"state" smallint DEFAULT 0 NOT NULL,
	"last_review" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_exactly_one_source" CHECK (num_nonnulls("mistake_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "review_log" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"grade" smallint NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"elapsed_ms" integer NOT NULL,
	"state_before" jsonb NOT NULL,
	"state_after" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"lichess_game_id" text NOT NULL,
	"pgn" text NOT NULL,
	"user_color" "user_color" NOT NULL,
	"speed" text NOT NULL,
	"time_control_initial_s" integer,
	"time_control_increment_s" integer,
	"rated" boolean NOT NULL,
	"result" "game_result" NOT NULL,
	"eco" text,
	"opening_name" text,
	"played_at" timestamp with time zone NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_analysis" (
	"game_id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"status" "analysis_status" DEFAULT 'pending'::"analysis_status" NOT NULL,
	"evals" jsonb,
	"screen_depth" integer,
	"confirm_depth" integer,
	"engine_id" text,
	"next_ply" integer DEFAULT 0 NOT NULL,
	"analysed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mistake" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"game_id" text NOT NULL,
	"ply" integer NOT NULL,
	"fen_before" text NOT NULL,
	"position_key" text NOT NULL,
	"played_san" text NOT NULL,
	"played_uci" text NOT NULL,
	"best_san" text NOT NULL,
	"best_uci" text NOT NULL,
	"eval_before_cp" integer NOT NULL,
	"eval_after_cp" integer NOT NULL,
	"eval_loss_cp" integer NOT NULL,
	"severity" "severity" NOT NULL,
	"phase" "phase" NOT NULL,
	"clock_left_ms" integer,
	"clock_initial_ms" integer,
	"eco" text,
	"opening_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lichess_profile" (
	"user_id" text PRIMARY KEY,
	"lichess_id" text NOT NULL UNIQUE,
	"username" text NOT NULL,
	"rating_snapshot" jsonb,
	"import_cursor_ms" bigint,
	"import_state" "lichess_import_state" DEFAULT 'idle'::"lichess_import_state" NOT NULL,
	"import_retry_at" timestamp with time zone,
	"import_lease_until" timestamp with time zone,
	"import_error" text,
	"last_synced_at" timestamp with time zone,
	"first_import_done_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY,
	"daily_new_card_limit" integer DEFAULT 20 NOT NULL,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"board_orientation_auto" boolean DEFAULT true NOT NULL,
	"explorer_band_offset" smallint DEFAULT 0 NOT NULL,
	"blindfold_level" smallint DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "card_userId_due_idx" ON "card" ("user_id","due");--> statement-breakpoint
CREATE INDEX "card_userId_state_idx" ON "card" ("user_id","state");--> statement-breakpoint
CREATE INDEX "reviewLog_userId_reviewedAt_idx" ON "review_log" ("user_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "reviewLog_cardId_reviewedAt_idx" ON "review_log" ("card_id","reviewed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "game_userId_lichessGameId_uidx" ON "game" ("user_id","lichess_game_id");--> statement-breakpoint
CREATE INDEX "game_userId_playedAt_idx" ON "game" ("user_id","played_at" desc);--> statement-breakpoint
CREATE INDEX "gameAnalysis_userId_status_idx" ON "game_analysis" ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "mistake_gameId_ply_uidx" ON "mistake" ("game_id","ply");--> statement-breakpoint
CREATE INDEX "mistake_userId_positionKey_playedUci_idx" ON "mistake" ("user_id","position_key","played_uci");--> statement-breakpoint
CREATE INDEX "mistake_userId_eco_idx" ON "mistake" ("user_id","eco");--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_mistake_id_mistake_id_fkey" FOREIGN KEY ("mistake_id") REFERENCES "mistake"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "review_log" ADD CONSTRAINT "review_log_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "review_log" ADD CONSTRAINT "review_log_card_id_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "card"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game_analysis" ADD CONSTRAINT "game_analysis_game_id_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game_analysis" ADD CONSTRAINT "game_analysis_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mistake" ADD CONSTRAINT "mistake_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mistake" ADD CONSTRAINT "mistake_game_id_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lichess_profile" ADD CONSTRAINT "lichess_profile_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;