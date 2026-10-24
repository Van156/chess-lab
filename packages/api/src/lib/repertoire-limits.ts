// Input limits of the repertoire feature. Pure data shared by the oRPC router (zod schemas) and
// the web builder (name and idea-note validation), so the limits the UI enforces are exactly the
// ones the server accepts.

/** Longest repertoire name, in characters, after trimming. */
export const REPERTOIRE_NAME_MAX_LENGTH = 80;

/** Longest one-line plan of an idea note, in characters, after trimming. */
export const IDEA_NOTE_PLAN_MAX_LENGTH = 140;

/** Cap on the arrows and on the highlighted squares of one idea note; keeps the jsonb bounded. */
export const IDEA_NOTE_MAX_ITEMS = 32;
