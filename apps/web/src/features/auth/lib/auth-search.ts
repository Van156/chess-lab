import z from "zod";

/** Search params the auth pages thread between each other (sign-in, sign-up, `/login`, guards). */
export type AuthSearch = { redirect?: string; error?: string };

/** `validateSearch` for `/sign-in` and `/sign-up`. */
export const authSearchSchema = z.object({
  redirect: z.string().optional(),
  // Set by better-auth on the `errorCallbackURL` return of a failed OAuth round trip.
  error: z.string().optional(),
});

/** Keeps only the known, non-empty string params; everything else is dropped. */
export function pickAuthSearch(search: Record<string, unknown> | undefined): AuthSearch {
  const out: AuthSearch = {};
  if (typeof search?.redirect === "string" && search.redirect !== "") {
    out.redirect = search.redirect;
  }
  return out;
}

/** Target for `/login` and for route guards: `/sign-in`, preserving `redirect`. */
export function signInRedirect(search?: Record<string, unknown>) {
  return { to: "/sign-in" as const, search: pickAuthSearch(search) };
}

/** Search for the sign-in <-> sign-up switch links. */
export function authLinkSearch(search?: AuthSearch): AuthSearch {
  return pickAuthSearch(search);
}

/** Where a successful sign-in lands. */
export function postSignInPath(): string {
  return "/dashboard";
}

/**
 * URLs for `authClient.signIn.social`: success lands on `postSignInPath`; a failed round trip
 * returns to `errorPath` (better-auth appends `?error=`).
 */
export function socialSignInTargets({ origin, errorPath }: { origin: string; errorPath: string }) {
  return {
    callbackURL: `${origin}${postSignInPath()}`,
    errorCallbackURL: `${origin}${errorPath}`,
  };
}
