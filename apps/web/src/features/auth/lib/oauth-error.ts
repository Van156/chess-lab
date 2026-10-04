/**
 * Messages for the `?error=` a failed OAuth round trip returns through
 * `errorCallbackURL` (better-auth 1.7.5 `callback.mjs`: `redirectOnError` appends
 * `error` and optionally `error_description`). `error_description` comes from the
 * URL and is never rendered: every known code maps to fixed text.
 */
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Sign-in was cancelled.",
  account_not_linked:
    "An account with this email already exists, and the provider could not confirm the email is verified. Sign in with your password instead.",
  email_not_verified: "Verify your email address with the provider before signing in with it.",
  signup_disabled: "Sign-up with this provider is not available.",
};

export const OAUTH_FALLBACK_MESSAGE = "Could not sign in with this provider. Please try again.";

/** The inline error for an OAuth return URL, or `null` when there is no `error` param. */
export function oauthErrorMessage(code: string | undefined): string | null {
  if (!code) {
    return null;
  }
  return OAUTH_ERROR_MESSAGES[code] ?? OAUTH_FALLBACK_MESSAGE;
}
