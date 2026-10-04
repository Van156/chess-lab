import type { Session } from "@b2c-template/auth";
import type { AuditLogger } from "@b2c-template/auth/audit";
import type { Database } from "@b2c-template/db";

import type { AuthorizationPort } from "./authorization";
import type { PlatformAdminPort } from "./platform-admin";

export type Context = {
  session: Session | null;
  db: Database;
  /** Inbound request headers; ports may re-derive the session from them. */
  headers: Headers;
  authorization: AuthorizationPort;
  /** Platform admin actions; impersonation uses the better-auth client instead. */
  platformAdmin: PlatformAdminPort;
  /**
   * Audit port for mutations the procedures perform directly in the database, which
   * better-auth's hooks never see. Type-only import: `packages/api` needs no better-auth
   * runtime dependency.
   */
  auditLogger: AuditLogger;
};
