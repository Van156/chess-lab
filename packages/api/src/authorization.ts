import type { platformStatements } from "@b2c-template/auth/permissions";

/** Permission-check input typed against a statements catalog; unknown features or actions fail to compile. */
type PermissionsFromStatements<TStatements extends Record<string, readonly string[]>> = {
  [TFeature in keyof TStatements]?: Array<TStatements[TFeature][number]>;
};

/** Permission shape accepted by `platformProcedure`, typed against `platformStatements`. */
export type PlatformPermissions = PermissionsFromStatements<typeof platformStatements>;

/**
 * Authorization port the procedure builders depend on instead of better-auth.
 * See docs/architecture/authorization.md#authorization-port
 */
export interface AuthorizationPort {
  /** Whether the given user holds every given platform (operator-layer) permission. */
  hasPlatformPermission(userId: string, permissions: Record<string, string[]>): Promise<boolean>;
}

/** Structural subset of better-auth's `api` used here, so `packages/api` needs no better-auth import. */
export type AuthorizationAuthApi = {
  api: {
    /** POST `/admin/has-permission` (admin plugin). */
    userHasPermission: (input: {
      body: { userId: string; permissions: Record<string, string[]> };
    }) => Promise<{ error: string | null; success: boolean }>;
  };
};

/**
 * Structural shape of better-auth's `APIError`, checked by `name` instead of `instanceof`
 * to avoid a runtime better-auth dependency. See docs/architecture/authorization.md#error-mapping
 */
type BetterAuthApiErrorShape = {
  status: string | number;
  body?: { code?: string; message?: string } | null;
};

function isBetterAuthApiError(error: unknown): error is BetterAuthApiErrorShape {
  return (
    typeof error === "object" && error !== null && (error as { name?: unknown }).name === "APIError"
  );
}

/**
 * Whether `error` is a documented "denied" outcome, matched by `body.code` or, for code-less
 * errors, by message. Anything else must propagate as a 500, not a silent denial.
 */
function isExpectedDenial(
  error: unknown,
  codes: readonly string[],
  messages: readonly string[] = [],
): boolean {
  if (!isBetterAuthApiError(error)) {
    return false;
  }
  const code = error.body?.code;
  if (code !== undefined && codes.includes(code)) {
    return true;
  }
  const message = error.body?.message;
  return message !== undefined && messages.includes(message);
}

/** Logs an unexpected failure by operation and error name/message only, never headers or permissions. */
function logUnexpectedAuthorizationError(operation: string, error: unknown): void {
  console.error(`[authorization] ${operation} failed unexpectedly`, {
    operation,
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
  });
}

/**
 * `AuthorizationPort` backed by better-auth's admin plugin. Documented denials
 * map to `null`/`false`; other errors are logged and rethrown.
 * See docs/architecture/authorization.md#error-mapping
 */
export function createBetterAuthAuthorization(auth: AuthorizationAuthApi): AuthorizationPort {
  return {
    async hasPlatformPermission(userId, permissions) {
      try {
        const result = await auth.api.userHasPermission({ body: { userId, permissions } });
        return result.success;
      } catch (error) {
        if (isExpectedDenial(error, [], ["user not found"])) {
          return false;
        }
        logUnexpectedAuthorizationError("hasPlatformPermission", error);
        throw error;
      }
    },
  };
}
