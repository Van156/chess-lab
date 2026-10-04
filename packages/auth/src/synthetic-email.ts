/**
 * Synthetic addresses for Lichess accounts (ADR-07). Lichess accounts have no email by default
 * (the `email:read` scope is never requested), so the account gets `<id>@lichess.invalid`. The
 * `.invalid` TLD is reserved by RFC 2606 and can never be delivered or collide with a real mailbox.
 */
export const SYNTHETIC_EMAIL_DOMAIN = "lichess.invalid";

/** Unique, non-deliverable email for a Lichess account id (the immutable lowercase id). */
export function syntheticEmail(lichessId: string): string {
  return `${lichessId}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

/** True when `email` is a synthetic Lichess address; mail must never be sent to it. */
export function isSyntheticEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  return at > 0 && normalized.slice(at + 1) === SYNTHETIC_EMAIL_DOMAIN;
}
