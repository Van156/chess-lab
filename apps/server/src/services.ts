import { parseFeatureFlags } from "@b2c-template/api/features";
import { createBetterAuthAuthorization } from "@b2c-template/api/authorization";
import { createBetterAuthPlatformAdmin } from "@b2c-template/api/platform-admin";
import { createAuth } from "@b2c-template/auth";
import type { AuditRetentionJobHandle } from "@b2c-template/auth/audit";
import { createDrizzleAuditLogger, startAuditRetentionJob } from "@b2c-template/auth/audit";
import { createEmailSender } from "@b2c-template/auth/email";
import { createImportService } from "@b2c-template/api/services/import-service";
import { createDb } from "@b2c-template/db";
import { createLichessClient } from "@b2c-template/lichess";

import { createImportRunner } from "./import-runner";
import { ENV } from "./env.server";
import { createGamesSource, createLichessPort } from "./lichess-port";

export const db = createDb(ENV);
export const features = parseFeatureFlags(ENV);
export const emailSender = createEmailSender(ENV);
export const auditLogger = createDrizzleAuditLogger(db);
export const auth = createAuth(ENV, db, emailSender, auditLogger);
export const authorization = createBetterAuthAuthorization(auth);
export const platformAdmin = createBetterAuthPlatformAdmin(auth);

// Lichess (ADR-09, ADR-10): one client (it owns the per-user serial gate), the token resolved
// server-side from the encrypted account row, and a runner that owns the background imports.
const lichessClient = createLichessClient({ fetch });
const importService = createImportService({
  db,
  source: createGamesSource(lichessClient, async (userId) => {
    // better-auth selects the account by its provider account id, which is the Lichess id.
    const profile = await db.query.lichessProfile.findFirst({
      columns: { lichessId: true },
      where: { userId },
    });
    if (!profile) return null;
    const tokens = await auth.api.getAccessToken({
      body: { accountId: profile.lichessId, userId },
    });
    return tokens.accessToken ?? null;
  }),
});
const importRunner = createImportRunner(importService);
export const lichess = createLichessPort(importService, importRunner);

/**
 * Starts the background jobs (the R7.6 audit retention job) and returns a handle to stop them.
 * Deliberately not run at import: scripts and tests import this module, and a live timer must
 * never start as a side effect. Only `index.ts` calls it.
 */
export function startBackgroundJobs(): { stop: () => void } {
  // R7.6: unset AUDIT_LOG_RETENTION_DAYS means "keep forever" — no job starts.
  const retentionJob: AuditRetentionJobHandle | null = startAuditRetentionJob(
    db,
    ENV.AUDIT_LOG_RETENTION_DAYS,
  );
  return {
    stop: () => {
      retentionJob?.stop();
      // Aborts running imports: leases expire and the next trigger resumes from the cursor.
      importRunner.stop();
    },
  };
}
