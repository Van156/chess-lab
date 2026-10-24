import {
  IDEA_NOTE_MAX_ITEMS,
  IDEA_NOTE_PLAN_MAX_LENGTH,
} from "@b2c-template/api/lib/repertoire-limits";

import type { IdeaNote, NoteArrow } from "./repertoire-types";

/** Why the plan cannot be saved, or null when it can. Measured on the trimmed text, like the server. */
export function validatePlan(plan: string): string | null {
  const trimmed = plan.trim();
  if (/[\r\n]/.test(trimmed)) {
    return "The plan must be one line.";
  }
  if (trimmed.length > IDEA_NOTE_PLAN_MAX_LENGTH) {
    return `The plan must be ${IDEA_NOTE_PLAN_MAX_LENGTH} characters or fewer.`;
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

/** The squares without `square`; adding is `toggleHighlightInput`, which owns the cap. */
export function removeSquare(squares: readonly string[], square: string): string[] {
  return squares.filter((existing) => existing !== square);
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
  return arrows.length >= IDEA_NOTE_MAX_ITEMS ? [...arrows] : [...arrows, arrow];
}

/** Same arrows, highlights and trimmed plan, in the same order. */
export function notesEqual(a: IdeaNote, b: IdeaNote): boolean {
  return (
    a.plan.trim() === b.plan.trim() &&
    a.highlights.length === b.highlights.length &&
    a.highlights.every((square, i) => square === b.highlights[i]) &&
    a.arrows.length === b.arrows.length &&
    a.arrows.every((arrow, i) => arrow.from === b.arrows[i]?.from && arrow.to === b.arrows[i]?.to)
  );
}
