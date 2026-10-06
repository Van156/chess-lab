import {
  deleteErrorMessage,
  REAUTH_REQUIRED,
  usernameMatches,
  type LichessDeleteResult,
} from "./lichess-account";

/** What the delete card knows: the typed name, the account's name, and the last attempt. */
export type DeleteCardState = {
  typed: string;
  username: string;
  pending: boolean;
  /** Code of the last failed attempt; `""` is a failure without a known code, `null` is none. */
  errorCode: string | null;
};

export type DeleteCardView = {
  canSubmit: boolean;
  error: { message: string; showReauth: boolean } | null;
};

/** Pure view of the card: whether submitting is allowed and which error (and re-auth) to show. */
export function deleteCardView({
  typed,
  username,
  pending,
  errorCode,
}: DeleteCardState): DeleteCardView {
  return {
    canSubmit: usernameMatches(typed, username) && !pending,
    error:
      errorCode === null
        ? null
        : { message: deleteErrorMessage(errorCode), showReauth: errorCode === REAUTH_REQUIRED },
  };
}

/** The error code to remember for an attempt's outcome; `null` when it succeeded. */
export function errorCodeOf(result: LichessDeleteResult): string | null {
  return result.ok ? null : (result.code ?? "");
}

/** Error code for an attempt that threw: the outcome is unknown, so no specific code. */
export const UNKNOWN_FAILURE_CODE = "";

/** Which control to focus on mount: returning from Lichess re-auth lands on the username input. */
export function initialFocusTarget(confirmRequested: boolean): "username-input" | null {
  return confirmRequested ? "username-input" : null;
}
