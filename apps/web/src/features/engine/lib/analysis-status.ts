/** Analysis status state machine and its user-facing description. Pure. */

export type AnalysisStage = "screen" | "confirm";

export type AnalysisStatus =
  | { phase: "idle" }
  | {
      phase: "running" | "paused";
      stage: AnalysisStage;
      done: number;
      total: number;
      analysed: number;
    }
  | { phase: "stopped" | "unavailable" | "failed"; analysed: number }
  | { phase: "finished"; analysed: number };

export type AnalysisEvent =
  | { type: "started" }
  | { type: "progress"; stage: AnalysisStage; done: number; total: number }
  | { type: "gameCompleted" }
  | { type: "paused" }
  | { type: "resumed" }
  | { type: "stopped" }
  | { type: "unavailable" }
  | { type: "failed" }
  | { type: "finished" };

export const initialStatus: AnalysisStatus = { phase: "idle" };

const analysedOf = (status: AnalysisStatus): number => ("analysed" in status ? status.analysed : 0);

export function reduceStatus(status: AnalysisStatus, event: AnalysisEvent): AnalysisStatus {
  const analysed = analysedOf(status);
  switch (event.type) {
    case "started":
      return { phase: "running", stage: "screen", done: 0, total: 0, analysed };
    case "progress":
      return {
        phase: status.phase === "paused" ? "paused" : "running",
        stage: event.stage,
        done: event.done,
        total: event.total,
        analysed,
      };
    case "gameCompleted":
      return status.phase === "running" || status.phase === "paused"
        ? { ...status, analysed: analysed + 1 }
        : status;
    case "paused":
      return status.phase === "running" ? { ...status, phase: "paused" } : status;
    case "resumed":
      return status.phase === "paused" ? { ...status, phase: "running" } : status;
    case "stopped":
    case "unavailable":
    case "failed":
      return { phase: event.type, analysed };
    case "finished":
      return analysed > 0 ? { phase: "finished", analysed } : { phase: "idle" };
  }
}

export interface AnalysisDescription {
  message: string;
  tone: "neutral" | "warning" | "error";
  /** Percent 0..100, or `null` when there is nothing meaningful to measure. */
  progress: number | null;
  canResume: boolean;
}

const percent = (done: number, total: number): number | null =>
  total > 0 ? Math.min(100, Math.round((done / total) * 100)) : null;

function describeProgress(status: Extract<AnalysisStatus, { stage: AnalysisStage }>) {
  if (status.total === 0) return { message: "Preparing analysis", progress: null };
  const label =
    status.stage === "screen" ? "Analysing your latest game" : "Checking your key moves";
  return {
    message: `${label}: ${status.done} of ${status.total}`,
    progress: percent(status.done, status.total),
  };
}

/** What to show for a status, or `null` when nothing should be shown. */
export function describeStatus(status: AnalysisStatus): AnalysisDescription | null {
  switch (status.phase) {
    case "idle":
      return null;
    case "running":
      return { ...describeProgress(status), tone: "neutral", canResume: false };
    case "paused":
      return {
        ...describeProgress(status),
        message: "Analysis paused while you review. It continues afterwards.",
        tone: "neutral",
        canResume: false,
      };
    case "stopped":
      return {
        message: "Analysis stopped while this tab was in the background.",
        tone: "warning",
        progress: null,
        canResume: true,
      };
    case "unavailable":
      return {
        message: "Engine unavailable. Game analysis needs the chess engine to load.",
        tone: "error",
        progress: null,
        canResume: true,
      };
    case "failed":
      return {
        message: "Analysis stopped after an error. Your progress is saved.",
        tone: "error",
        progress: null,
        canResume: true,
      };
    case "finished":
      return {
        message: `Analysis complete: ${status.analysed} ${status.analysed === 1 ? "game" : "games"} analysed.`,
        tone: "neutral",
        progress: 100,
        canResume: false,
      };
  }
}

/** True for the review session route, where analysis yields the engine and CPU. */
export const isReviewPath = (pathname: string): boolean =>
  pathname === "/review" || pathname.startsWith("/review/");
