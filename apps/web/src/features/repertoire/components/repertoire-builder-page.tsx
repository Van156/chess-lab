import { buttonVariants } from "@b2c-template/ui/components/button";
import { cn } from "@b2c-template/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { BookMarked } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { SUGGESTION_DEPTH, SUGGESTION_PV_PLIES } from "@/features/engine";
import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";
import EmptyState from "@/shared/components/feedback/empty-state";
import LoadError from "@/shared/components/feedback/load-error";
import Loader from "@/shared/components/feedback/loader";

import { useExplorer } from "../hooks/use-explorer";
import { useEngineSuggestions } from "../hooks/use-engine-suggestions";
import { useEngineToggle } from "../hooks/use-engine-toggle";
import { useExplorerBand } from "../hooks/use-explorer-band";
import { useLineCount, useRepertoireArrows } from "../hooks/use-lines-preference";
import { useOpeningName } from "../hooks/use-opening-name";
import { useRepertoire } from "../hooks/use-repertoire";
import { boardLinesFor } from "../lib/board-lines";
import { findMove, lineFens, positionAfterRemoval, resolvePosition } from "../lib/builder-state";
import { notesEqual } from "../lib/idea-note";
import { draftAfterDelete, draftAfterSave, type Draft } from "../lib/note-draft";
import { toEngineView } from "../lib/suggestion-state";
import { isNotFound } from "../lib/repertoire-query";
import { childMoves, pathTo, removalPreview } from "../lib/repertoire-tree";
import type { IdeaNote, RepertoireMove } from "../lib/repertoire-types";
import { buildVariationTree } from "../lib/variation-tree";
import RepertoireBuilderView from "./repertoire-builder-view";

const NO_NOTE: IdeaNote = { arrows: [], highlights: [], plan: "" };

type Where = { positionId: string | null; route: string[] };

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
  // Resolved before the early returns so the explorer hook runs on every render; it stays idle
  // until the repertoire has loaded.
  const currentId = repertoire ? resolvePosition(repertoire, where.positionId) : "";
  const explorer = useExplorer(id, currentId);
  const explorerBand = useExplorerBand();
  // The engine hooks also run before the early returns. Until the position resolves the FEN is
  // empty and the search is disabled, so the engine is never asked about an invalid position.
  const [engineOn, setEngineOn] = useEngineToggle();
  const currentFen = repertoire?.positions.find((candidate) => candidate.id === currentId)?.fen;
  const [lineCount, setLineCount] = useLineCount();
  const [showRepertoireArrows, setShowRepertoireArrows] = useRepertoireArrows();
  const suggestions = useEngineSuggestions(
    currentFen ?? "",
    engineOn && currentFen !== undefined,
    lineCount,
  );
  // The outline depends on the graph and the shown line only, so it is rebuilt on those two and
  // never on an engine frame; the callbacks below are stable for the same reason (the tree is memoised).
  const path = useMemo(
    () => (repertoire ? pathTo(repertoire, currentId, where.route) : null),
    [repertoire, currentId, where.route],
  );
  // The FENs from the start position to the shown one, for the opening name.
  const fens = useMemo(
    () => (repertoire && path ? lineFens(repertoire, path) : null),
    [repertoire, path],
  );
  const opening = useOpeningName(fens);
  const tree = useMemo(
    () => (repertoire && path ? buildVariationTree(repertoire, path) : null),
    [repertoire, path],
  );
  const go = useCallback(
    (positionId: string, route: string[]) => setWhere({ positionId, route }),
    [],
  );
  const requestDeleteById = useCallback(
    (moveId: string) => {
      const move = repertoire ? findMove(repertoire, moveId) : undefined;
      if (move) setDeleting(move);
    },
    [repertoire],
  );

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

  const positionId = currentId;
  const position = repertoire.positions.find((candidate) => candidate.id === positionId);
  if (!position || !path || !tree) {
    return <LoadError message="This position could not be shown." onRetry={retry} />;
  }

  const savedNote = repertoire.notes[positionId] ?? NO_NOTE;
  const note = draft?.positionId === positionId ? draft.note : savedNote;
  const routeTo = (moves: readonly RepertoireMove[]) => moves.map((move) => move.id);

  const playMove = async (san: string) => {
    try {
      const { move } = await addMove({ repertoireId: id, fromPositionId: position.id, move: san });
      go(move.toPositionId, [...routeTo(path), move.id]);
    } catch (failure) {
      reportFailure(failure, "The move could not be added.");
    }
  };

  const changeBandOffset = async (explorerBandOffset: number) => {
    try {
      await explorerBand.setOffset({ explorerBandOffset });
    } catch (failure) {
      reportFailure(failure, "The rating band could not be changed.");
    }
  };

  // `next` is what is stored; `shown` is the draft on screen when the user asked, which is the
  // only draft the save may discard (Clear stores an empty note but discards the shown draft).
  const saveNote = async (next: IdeaNote, shown: IdeaNote) => {
    const savedAt = position.id;
    try {
      await setIdeaNote({
        repertoireId: id,
        positionId: savedAt,
        arrows: next.arrows,
        highlights: next.highlights,
        plan: next.plan.trim(),
      });
      setDraft((current) => draftAfterSave(current, savedAt, shown));
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
    setDraft((current) => draftAfterDelete(current, repertoire, move.id));
    setDeleting(null);
    go(next, []);
  };

  const children = childMoves(repertoire, positionId);
  const engine = toEngineView({
    state: suggestions.state,
    fen: position.fen,
    enabled: engineOn,
    childMoves: children,
    maxDepth: SUGGESTION_DEPTH,
    maxPlies: SUGGESTION_PV_PLIES,
  });

  const board = boardLinesFor({
    panel: engine.panel,
    noteArrows: note.arrows,
    lineCount,
    repertoireMoves: children,
    showRepertoire: showRepertoireArrows,
  });

  const removal = deleting ? removalPreview(repertoire, deleting.id) : null;

  return (
    <>
      <RepertoireBuilderView
        repertoire={repertoire.repertoire}
        position={position}
        path={path}
        childMoves={children}
        tree={tree}
        startPositionId={repertoire.startPositionId}
        opening={opening ?? null}
        engine={engine}
        boardArrows={board.arrows}
        boardArrowText={board.text}
        lineCount={lineCount}
        showRepertoireArrows={showRepertoireArrows}
        explorer={explorer}
        note={note}
        noteDirty={!notesEqual(note, savedNote)}
        saving={isSaving}
        bandSaving={explorerBand.isPending}
        onPlayMove={(san) => void playMove(san)}
        onToggleEngine={setEngineOn}
        onRetryEngine={suggestions.retry}
        onChangeLineCount={setLineCount}
        onToggleRepertoireArrows={setShowRepertoireArrows}
        onChangeBandOffset={(offset) => void changeBandOffset(offset)}
        onSelectPly={(ply) => {
          const walked = path.slice(0, ply);
          go(
            walked[walked.length - 1]?.toPositionId ?? repertoire.startPositionId,
            routeTo(walked),
          );
        }}
        onSelectNode={go}
        onDeleteNode={requestDeleteById}
        onRequestDelete={setDeleting}
        onNoteChange={(next) => setDraft({ positionId, note: next })}
        onSaveNote={() => void saveNote(note, note)}
        onClearNote={() => void saveNote(NO_NOTE, note)}
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
