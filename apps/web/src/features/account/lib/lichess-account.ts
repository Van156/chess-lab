/**
 * Lichess-only accounts (ADR-07/08). Their email is a synthetic `<lichess-id>@lichess.invalid`
 * address that can never receive mail, so email, password and emailed-link flows do not apply.
 *
 * The web app may not import `@b2c-template/auth` (server-only except `/permissions`), so the
 * reserved domain is mirrored from `packages/auth/src/synthetic-email.ts`.
 */
const SYNTHETIC_EMAIL_DOMAIN = "lichess.invalid";

/** Query param the Lichess re-auth round trip returns with to reopen the confirmation step. */
export const CONFIRM_PARAM = "confirm";

/** Path of the danger page, also the re-auth landing page. */
export const DANGER_PATH = "/account/danger";

/**
 * Server error codes of `POST /api/auth/lichess/delete-account`, mirrored from
 * `LICHESS_DELETE_ERROR_CODES` in `packages/auth/src/lichess-account.ts` (the web app may not
 * import `@b2c-template/auth`). Keep both lists in sync.
 */
export const LICHESS_DELETE_ERROR_CODES = {
  IMPERSONATION_NOT_ALLOWED: "IMPERSONATION_NOT_ALLOWED",
  LICHESS_ONLY_ACCOUNT_REQUIRED: "LICHESS_ONLY_ACCOUNT_REQUIRED",
  REAUTH_REQUIRED: "REAUTH_REQUIRED",
  USERNAME_MISMATCH: "USERNAME_MISMATCH",
} as const;

export type LichessDeleteErrorCode =
  (typeof LICHESS_DELETE_ERROR_CODES)[keyof typeof LICHESS_DELETE_ERROR_CODES];

export const REAUTH_REQUIRED = LICHESS_DELETE_ERROR_CODES.REAUTH_REQUIRED;

/** True when `email` is a synthetic Lichess address (mirrors the server helper). */
export function isSyntheticEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  return at > 0 && normalized.slice(at + 1) === SYNTHETIC_EMAIL_DOMAIN;
}

export type AccountFlows = {
  changeEmail: boolean;
  password: boolean;
  emailedDeletion: boolean;
  typedUsernameDeletion: boolean;
};

/** Which account flows apply: a synthetic-email user can only use the typed-username deletion. */
export function accountFlows(email: string): AccountFlows {
  const deliverable = !isSyntheticEmail(email);
  return {
    changeEmail: deliverable,
    password: deliverable,
    emailedDeletion: deliverable,
    typedUsernameDeletion: !deliverable,
  };
}

/**
 * The Lichess username to type, from the synthetic email's local part. It is the immutable
 * lowercase Lichess id, which equals the username compared case-insensitively. `null` for a
 * non-synthetic email.
 */
export function lichessUsernameFromEmail(email: string): string | null {
  if (!isSyntheticEmail(email)) {
    return null;
  }
  const normalized = email.trim();
  return normalized.slice(0, normalized.lastIndexOf("@"));
}

/** Same rule as the server: trimmed, case-insensitive; an empty input never matches. */
export function usernameMatches(typed: string, expected: string): boolean {
  const value = typed.trim().toLowerCase();
  return value !== "" && value === expected.trim().toLowerCase();
}

/** Exhaustive by type: a code added to the mirror without a message is a compile error. */
const DELETE_ERROR_MESSAGES: Record<LichessDeleteErrorCode, string> = {
  IMPERSONATION_NOT_ALLOWED: "Impersonated sessions cannot delete an account.",
  LICHESS_ONLY_ACCOUNT_REQUIRED:
    "This account has an email address. Use the emailed confirmation link to delete it.",
  REAUTH_REQUIRED: "For your safety, sign in with Lichess again to confirm the deletion.",
  USERNAME_MISMATCH: "The typed username does not match this account.",
};

/**
 * Unknown outcome: a server 500 (audit or delete failure) or a network error may or may not have
 * deleted the account, and a failed delete can still have signed the user out. So it asserts
 * nothing about the state and tells the user how to find out.
 */
export const DELETE_FALLBACK_MESSAGE =
  "We could not confirm whether your account was deleted. Reload the page to check. If you are signed out and your games are gone after you sign in with Lichess again, contact support so we can confirm your old data was removed.";

function isDeleteErrorCode(code: string): code is LichessDeleteErrorCode {
  return Object.hasOwn(DELETE_ERROR_MESSAGES, code);
}

/** User-facing message for a delete-account error code (unknown or missing codes get a fallback). */
export function deleteErrorMessage(code: string | undefined): string {
  return code !== undefined && isDeleteErrorCode(code)
    ? DELETE_ERROR_MESSAGES[code]
    : DELETE_FALLBACK_MESSAGE;
}

/** Absolute URL Lichess re-auth returns to, reopening the confirmation step. */
export function reauthCallbackUrl(origin: string): string {
  return `${origin}${DANGER_PATH}?${CONFIRM_PARAM}=1`;
}

/** Parsed search of the danger page. */
export type DangerSearch = { confirm: boolean };

/**
 * `validateSearch` of `/account/danger`: the router parses `?confirm=1` to the number `1`, a raw
 * string stays `"1"`. Anything else (absent, `0`, junk) never throws and means "not requested".
 */
export function parseDangerSearch(search: Record<string, unknown>): DangerSearch {
  const value = search[CONFIRM_PARAM];
  return { confirm: value === 1 || value === "1" };
}

/** Outcome of a delete attempt; `code` is the server's error code when it sent one. */
export type LichessDeleteResult = { ok: true } | { ok: false; code?: string };
