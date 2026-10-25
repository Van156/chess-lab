import type { AppRouterClient } from "@b2c-template/api/routers/index";

/** One row of `repertoire.list`. */
export type RepertoireSummary = Awaited<ReturnType<AppRouterClient["repertoire"]["list"]>>[number];

/** Which side the repertoire is played from. */
export type RepertoireColor = RepertoireSummary["color"];

/** What `repertoire.get` returns: the repertoire as a position graph plus its idea notes. */
export type RepertoireData = Awaited<ReturnType<AppRouterClient["repertoire"]["get"]>>;

/** What `repertoire.deleteMove` returns for undo: pass it back to `restoreDeleted` unchanged. */
export type DeletionSnapshot = Awaited<
  ReturnType<AppRouterClient["repertoire"]["deleteMove"]>
>["snapshot"];

export type RepertoirePosition = RepertoireData["positions"][number];

export type RepertoireMove = RepertoireData["moves"][number];

/** One idea note: arrows and highlighted squares on the board plus a one-line plan. */
export type IdeaNote = RepertoireData["notes"][string];

export type NoteArrow = IdeaNote["arrows"][number];

/** What `repertoire.explorer` returns: the rating band in use and the stats or why there are none. */
export type ExplorerData = Awaited<ReturnType<AppRouterClient["repertoire"]["explorer"]>>;

export type ExplorerResult = ExplorerData["result"];

/** An explorer result that carries stats. */
export type ExplorerStats = Extract<ExplorerResult, { status: "ok" }>;

export type ExplorerMove = ExplorerStats["moves"][number];

export type ExplorerUnavailableReason = Extract<
  ExplorerResult,
  { status: "unavailable" }
>["reason"];
