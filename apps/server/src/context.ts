import type { Context as ApiContext } from "@b2c-template/api/context";
import type { Context as HonoContext } from "hono";

import { auditLogger, auth, authorization, db, platformAdmin } from "./services";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions): Promise<ApiContext> {
  const headers = context.req.raw.headers;
  const session = await auth.api.getSession({ headers });
  return {
    db,
    session,
    headers,
    authorization,
    platformAdmin,
    auditLogger,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
