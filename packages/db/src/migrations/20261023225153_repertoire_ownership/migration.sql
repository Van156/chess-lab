ALTER TABLE "card" DROP CONSTRAINT "card_repertoire_position_id_repertoire_position_id_fkey";--> statement-breakpoint
ALTER TABLE "idea_note" DROP CONSTRAINT "idea_note_repertoire_position_id_repertoire_position_id_fkey";--> statement-breakpoint
ALTER TABLE "repertoire_move" DROP CONSTRAINT "repertoire_move_repertoire_id_repertoire_id_fkey";--> statement-breakpoint
ALTER TABLE "repertoire_move" DROP CONSTRAINT "repertoire_move_from_position_id_repertoire_position_id_fkey";--> statement-breakpoint
ALTER TABLE "repertoire_move" DROP CONSTRAINT "repertoire_move_to_position_id_repertoire_position_id_fkey";--> statement-breakpoint
ALTER TABLE "repertoire_position" DROP CONSTRAINT "repertoire_position_repertoire_id_repertoire_id_fkey";--> statement-breakpoint
ALTER TABLE "repertoire" ADD CONSTRAINT "repertoire_id_userId_uq" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "repertoire_position" ADD CONSTRAINT "repertoirePosition_id_repertoireId_userId_uq" UNIQUE("id","repertoire_id","user_id");--> statement-breakpoint
ALTER TABLE "repertoire_position" ADD CONSTRAINT "repertoirePosition_id_userId_uq" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_repertoirePosition_owner_fk" FOREIGN KEY ("repertoire_position_id","user_id") REFERENCES "repertoire_position"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "idea_note" ADD CONSTRAINT "ideaNote_position_owner_fk" FOREIGN KEY ("repertoire_position_id","user_id") REFERENCES "repertoire_position"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "repertoire_move" ADD CONSTRAINT "repertoireMove_repertoire_owner_fk" FOREIGN KEY ("repertoire_id","user_id") REFERENCES "repertoire"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "repertoire_move" ADD CONSTRAINT "repertoireMove_from_position_fk" FOREIGN KEY ("from_position_id","repertoire_id","user_id") REFERENCES "repertoire_position"("id","repertoire_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "repertoire_move" ADD CONSTRAINT "repertoireMove_to_position_fk" FOREIGN KEY ("to_position_id","repertoire_id","user_id") REFERENCES "repertoire_position"("id","repertoire_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "repertoire_position" ADD CONSTRAINT "repertoirePosition_repertoire_owner_fk" FOREIGN KEY ("repertoire_id","user_id") REFERENCES "repertoire"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "repertoire_position" ADD CONSTRAINT "repertoire_position_side_to_move_check" CHECK ("side_to_move" in ('w', 'b'));