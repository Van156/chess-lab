import type { IdeaNote, NoteArrow } from "./repertoire-types";

/** Same limits as the server: a plan is one line of at most 140 characters, lists hold 32 items. */
export const MAX_PLAN_LENGTH = 140;
export const MAX_NOTE_ITEMS = 32;

/** Why the plan cannot be saved, or null when it can. Measured on the trimmed text, like the server. */
export function validatePlan(plan: string): string | null {
  const trimmed = plan.trim();
  if (/[\r\n]/.test(trimmed)) {
    return "The plan must be one line.";
  }
  if (trimmed.length > MAX_PLAN_LENGTH) {
    return `The plan must be ${MAX_PLAN_LENGTH} characters or fewer.`;
  }
  return null;
}

/** A note with nothing to keep; saving one clears the stored note. */
export function isEmptyNote(note: IdeaNote): boolean {
  return note.arrows.length === 0 && note.highlights.length === 0 && note.plan.trim() === "";
}

/** The note in words, for people who cannot see the board overlay. */
export function describeNote(note: IdeaNote): string {
  if (isEmptyNote(note)) {
    return "No idea note.";
  }
  const parts: string[] = [];
  const arrows = note.arrows.map((arrow) => `${arrow.from} to ${arrow.to}`);
  if (arrows.length === 1) {
    parts.push(`Arrow ${arrows[0]}.`);
  } else if (arrows.length > 1) {
    parts.push(`Arrows: ${arrows.join(", ")}.`);
  }
  if (note.highlights.length > 0) {
    parts.push(`Highlighted: ${note.highlights.join(", ")}.`);
  }
  const plan = note.plan.trim();
  if (plan !== "") {
    parts.push(`Plan: ${plan}`);
  }
  return parts.join(" ");
}

/** Adds the square when missing, removes it when present; at the cap nothing more is added. */
export function toggleSquare(squares: readonly string[], square: string): string[] {
  if (squares.includes(square)) {
    return squares.filter((existing) => existing !== square);
  }
  return squares.length >= MAX_NOTE_ITEMS ? (squares as string[]) : [...squares, square];
}

/** Adds the arrow when missing, removes it when present; an arrow onto its own square is ignored. */
export function toggleArrow(arrows: readonly NoteArrow[], arrow: NoteArrow): NoteArrow[] {
  if (arrow.from === arrow.to) {
    return [...arrows];
  }
  const same = (other: NoteArrow) => other.from === arrow.from && other.to === arrow.to;
  if (arrows.some(same)) {
    return arrows.filter((other) => !same(other));
  }
  return arrows.length >= MAX_NOTE_ITEMS ? [...arrows] : [...arrows, arrow];
}
