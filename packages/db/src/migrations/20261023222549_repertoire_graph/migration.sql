CREATE TABLE "idea_note" (
	"repertoire_position_id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"arrows" jsonb,
	"highlights" jsonb,
	"plan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repertoire" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"color" "user_color" NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repertoire_move" (
	"id" text PRIMARY KEY,
	"repertoire_id" text NOT NULL,
	"user_id" text NOT NULL,
	"from_position_id" text NOT NULL,
	"to_position_id" text NOT NULL,
	"san" text NOT NULL,
	"uci" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repertoireMove_fromPositionId_uci_uq" UNIQUE("from_position_id","uci")
);
--> statement-breakpoint
CREATE TABLE "repertoire_position" (
	"id" text PRIMARY KEY,
	"repertoire_id" text NOT NULL,
	"user_id" text NOT NULL,
	"position_key" text NOT NULL,
	"fen" text NOT NULL,
	"side_to_move" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repertoirePosition_repertoireId_positionKey_uq" UNIQUE("repertoire_id","position_key")
);
--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "repertoire_position_id" text;--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_repertoire_position_id_key" UNIQUE("repertoire_position_id");--> statement-breakpoint
CREATE INDEX "ideaNote_userId_idx" ON "idea_note" ("user_id");--> statement-breakpoint
CREATE INDEX "repertoire_userId_idx" ON "repertoire" ("user_id");--> statement-breakpoint
CREATE INDEX "repertoireMove_repertoireId_idx" ON "repertoire_move" ("repertoire_id");--> statement-breakpoint
CREATE INDEX "repertoireMove_toPositionId_idx" ON "repertoire_move" ("to_position_id");--> statement-breakpoint
CREATE INDEX "repertoireMove_userId_idx" ON "repertoire_move" ("user_id");--> statement-breakpoint
CREATE INDEX "repertoirePosition_userId_idx" ON "repertoire_position" ("user_id");--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_repertoire_position_id_repertoire_position_id_fkey" FOREIGN KEY ("repertoire_position_id") REFERENCES "repertoire_position"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "idea_note" ADD CONSTRAINT "idea_note_repertoire_position_id_repertoire_position_id_fkey" FOREIGN KEY ("repertoire_position_id") REFERENCES "repertoire_position"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "idea_note" ADD CONSTRAINT "idea_note_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "repertoire" ADD CONSTRAINT "repertoire_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "repertoire_move" ADD CONSTRAINT "repertoire_move_repertoire_id_repertoire_id_fkey" FOREIGN KEY ("repertoire_id") REFERENCES "repertoire"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "repertoire_move" ADD CONSTRAINT "repertoire_move_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "repertoire_move" ADD CONSTRAINT "repertoire_move_from_position_id_repertoire_position_id_fkey" FOREIGN KEY ("from_position_id") REFERENCES "repertoire_position"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "repertoire_move" ADD CONSTRAINT "repertoire_move_to_position_id_repertoire_position_id_fkey" FOREIGN KEY ("to_position_id") REFERENCES "repertoire_position"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "repertoire_position" ADD CONSTRAINT "repertoire_position_repertoire_id_repertoire_id_fkey" FOREIGN KEY ("repertoire_id") REFERENCES "repertoire"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "repertoire_position" ADD CONSTRAINT "repertoire_position_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "card" DROP CONSTRAINT "card_exactly_one_source", ADD CONSTRAINT "card_exactly_one_source" CHECK (num_nonnulls("mistake_id", "repertoire_position_id") = 1);