import { ORPCError, os } from "@orpc/server";

import type { PlatformPermissions } from "./authorization";
import type { Context } from "./context";
import type { PillarFlag } from "./features";

export const o = os.$context<Context>();

export const publicProcedure = o;

const requireAuth = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({
    context: {
      session: context.session,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireAuth);

/**
 * Protected + requires a platform permission.
 * See docs/architecture/authorization.md#platform-procedures
 */
export function platformProcedure(permissions: PlatformPermissions) {
  return protectedProcedure.use(async ({ context, next }) => {
    const allowed = await context.authorization.hasPlatformPermission(
      context.session.user.id,
      permissions as Record<string, string[]>,
    );
    if (!allowed) {
      throw new ORPCError("FORBIDDEN", {
        message: "Missing required platform permission.",
      });
    }
    return next();
  });
}

/**
 * Protected + requires the pillar's feature flag (ADR-17). A pillar that is off answers
 * `NOT_FOUND`, as if the route did not exist; the user's stored data stays untouched.
 */
export function featureProcedure(pillar: PillarFlag) {
  return protectedProcedure.use(async ({ context, next }) => {
    if (!context.features[pillar]) {
      throw new ORPCError("NOT_FOUND");
    }
    return next();
  });
}
