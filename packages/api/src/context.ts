import type { Session } from "@b2c-template/auth";
import type { AuditLogger } from "@b2c-template/auth/audit";
import type { Database } from "@b2c-template/db";
import type { ExplorerStats } from "@b2c-template/lichess";

import type { AuthorizationPort } from "./authorization";
import type { FeatureFlags } from "./features";
import type { PlatformAdminPort } from "./platform-admin";

export type ImportStatus = {
  state: "idle" | "running" | "backoff" | "failed";
  lastSyncedAt: Date | null;
  retryAt: Date | null;
  gamesImported: number;
};

export type ExplorerQuery = {
  /** Identifies the position in the cache key; `fen` is what Lichess is asked. */
  positionKey: string;
  fen: string;
  /** One Lichess rating bucket. */
  band: number;
  speeds: readonly string[];
};

export type ExplorerResult =
  | { status: "ok"; stats: ExplorerStats; stale: boolean }
  | {
      status: "unavailable";
      reason: "unauthorized" | "rate_limited" | "timeout" | "error";
    };

/**
 * Lichess access for procedures. Type-only like `AuthorizationPort`: the token and the Lichess
 * client live behind it in `apps/server`, so `packages/api` never sees either.
 */
export type LichessPort = {
  status(userId: string): Promise<ImportStatus>;
  /** Starts a sync in the background when none runs; never throws for "already running". */
  requestSync(userId: string): Promise<ImportStatus>;
  /** Opening explorer stats for a position; never throws, and never carries the token. */
  explorer(userId: string, query: ExplorerQuery): Promise<ExplorerResult>;
};

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
  lichess: LichessPort;
  /** Per-deployment feature flags (ADR-17), parsed once at startup. */
  features: FeatureFlags;
};
