import { buttonVariants } from "@b2c-template/ui/components/button";
import { cn } from "@b2c-template/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { BookMarked } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";
import EmptyState from "@/shared/components/feedback/empty-state";
import LoadError from "@/shared/components/feedback/load-error";
import Loader from "@/shared/components/feedback/loader";

import { useRepertoire } from "../hooks/use-repertoire";
import { positionAfterRemoval, resolvePosition } from "../lib/builder-state";
import { notesEqual } from "../lib/idea-note";
import { isNotFound } from "../lib/repertoire-query";
import { childMoves, pathTo, removalPreview } from "../lib/repertoire-tree";
import type { IdeaNote, RepertoireMove } from "../lib/repertoire-types";
import RepertoireBuilderView from "./repertoire-builder-view";

const NO_NOTE: IdeaNote = { arrows: [], highlights: [], plan: "" };

type Where = { positionId: string | null; route: string[] };
type Draft = { positionId: string; note: IdeaNote };

function reportFailure(error: unknown, fallback: string) {
  toast.error(error instanceof Error && error.message ? error.message : fallback);
}

/**
 * `/repertoire/$id` (container): loads the repertoire graph and wires the builder. The position
 * being edited and the route taken to reach it live in component state, not the URL: a position
 * id is meaningless once a delete or another tab changes the tree, and `resolvePosition` falls
 * back to the start position in that case.
 */
export default function RepertoireBuilderPage({ id }: { id: string }) {
  const { repertoire, error, isPending, retry, addMove, deleteMove, setIdeaNote, isSaving } =
    useRepertoire(id);
  const [where, setWhere] = useState<Where>({ positionId: null, route: [] });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<RepertoireMove | null>(null);

  if (isPending) {
    return <Loader />;
  }
  if (isNotFound(error)) {
    return (
      <EmptyState
        icon={<BookMarked />}
        title="Repertoire not found"
        description="It may have been deleted, or it belongs to another account."
        action={
          <Link to="/repertoire" className={cn(buttonVariants(), "h-11 px-6")}>
            Back to repertoires
          </Link>
        }
      />
    );
  }
  if (!repertoire) {
    return <LoadError message="This repertoire could not be loaded." onRetry={retry} />;
  }

  const positionId = resolvePosition(repertoire, where.positionId);
  const position = repertoire.positions.find((candidate) => candidate.id === positionId);
  const path = pathTo(repertoire, positionId, where.route);
  if (!position || !path) {
    return <LoadError message="This position could not be shown." onRetry={retry} />;
  }

  const savedNote = repertoire.notes[positionId] ?? NO_NOTE;
  const note = draft?.positionId === positionId ? draft.note : savedNote;
  const routeTo = (moves: readonly RepertoireMove[]) => moves.map((move) => move.id);

  const go = (target: string, route: string[]) => setWhere({ positionId: target, route });

  const playMove = async (san: string) => {
    try {
      const { move } = await addMove({ repertoireId: id, fromPositionId: position.id, move: san });
      go(move.toPositionId, [...routeTo(path), move.id]);
    } catch (failure) {
      reportFailure(failure, "The move could not be added.");
    }
  };

  const saveNote = async (next: IdeaNote) => {
    try {
      await setIdeaNote({
        repertoireId: id,
        positionId: position.id,
        arrows: next.arrows,
        highlights: next.highlights,
        plan: next.plan.trim(),
      });
      setDraft(null);
    } catch (failure) {
      reportFailure(failure, "The note could not be saved.");
    }
  };

  const confirmDelete = async (move: RepertoireMove) => {
    const next = positionAfterRemoval(repertoire, move.id, positionId);
    try {
      await deleteMove({ repertoireId: id, moveId: move.id });
    } catch (failure) {
      reportFailure(failure, "The move could not be deleted.");
      throw failure;
    }
    setDraft(null);
    setDeleting(null);
    go(next, []);
  };

  const removal = deleting ? removalPreview(repertoire, deleting.id) : null;

  return (
    <>
      <RepertoireBuilderView
        repertoire={repertoire.repertoire}
        position={position}
        path={path}
        childMoves={childMoves(repertoire, positionId)}
        note={note}
        noteDirty={!notesEqual(note, savedNote)}
        saving={isSaving}
        onPlayMove={(san) => void playMove(san)}
        onSelectPly={(ply) => {
          const walked = path.slice(0, ply);
          go(
            walked[walked.length - 1]?.toPositionId ?? repertoire.startPositionId,
            routeTo(walked),
          );
        }}
        onSelectChild={(move) => go(move.toPositionId, [...routeTo(path), move.id])}
        onRequestDelete={setDeleting}
        onNoteChange={(next) => setDraft({ positionId, note: next })}
        onSaveNote={() => void saveNote(note)}
        onClearNote={() => void saveNote(NO_NOTE)}
      />
      <ConfirmDialog
        open={deleting !== null && removal !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={deleting ? `Delete ${deleting.san}?` : "Delete move?"}
        description={
          removal
            ? `${removal.moveIds.length} ${removal.moveIds.length === 1 ? "move" : "moves"} and ${removal.positionIds.length} ${removal.positionIds.length === 1 ? "position" : "positions"} with their idea notes will be deleted. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete move"
        onConfirm={async () => {
          if (deleting) await confirmDelete(deleting);
        }}
      />
    </>
  );
}
