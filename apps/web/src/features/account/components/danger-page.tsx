import { authClient } from "@/app/auth-client";
import { buildExportUrls, DataExportCard } from "@/features/data-control";
import { betterAuthErrorCode, betterAuthErrorMessage } from "@/features/auth";
import { ENV } from "@/env.public";
import Loader from "@/shared/components/feedback/loader";

import {
  accountFlows,
  lichessUsernameFromEmail,
  reauthCallbackUrl,
  type LichessDeleteResult,
} from "../lib/lichess-account";
import DeleteAccountCard from "./delete-account-card";
import LichessDeleteCard from "./lichess-delete-card";

const EXPORT_URLS = buildExportUrls(ENV.VITE_SERVER_URL);

/**
 * `/account/danger` (R6, container). With `sendDeleteAccountVerification` configured, `deleteUser`
 * only emails a link; the account is deleted when it is opened (`GET /delete-user/callback`),
 * which signs the user out and redirects to `callbackURL`, the public sign-in page. Lichess-only
 * users (synthetic email) cannot receive that link and use the typed-username flow instead.
 */
export default function DangerPage({ confirmRequested = false }: { confirmRequested?: boolean }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Loader />;
  }
  if (!session) {
    return null;
  }

  async function requestDeletion() {
    const { error } = await authClient.deleteUser({
      callbackURL: `${window.location.origin}/sign-in`,
    });
    if (error) {
      throw new Error(betterAuthErrorMessage(error, "Could not start the deletion."));
    }
  }

  async function deleteLichessAccount(confirmUsername: string): Promise<LichessDeleteResult> {
    try {
      const { error } = await authClient.$fetch("/lichess/delete-account", {
        method: "POST",
        body: { confirmUsername },
      });
      if (error) {
        return { ok: false, code: betterAuthErrorCode(error) };
      }
    } catch {
      return { ok: false };
    }
    // The server cleared the session cookie. A full navigation drops the stale session atom and
    // the whole query cache, leaving the app signed out on the public landing page.
    window.location.assign("/");
    return { ok: true };
  }

  function reauthWithLichess() {
    void authClient.signIn.social({
      provider: "lichess",
      callbackURL: reauthCallbackUrl(window.location.origin),
    });
  }

  const { email } = session.user;
  const username = lichessUsernameFromEmail(email);
  const flows = accountFlows(email);

  return (
    <div className="flex flex-col gap-6">
      <DataExportCard urls={EXPORT_URLS} />
      {flows.typedUsernameDeletion && username ? (
        <LichessDeleteCard
          username={username}
          confirmRequested={confirmRequested}
          onDelete={deleteLichessAccount}
          onReauth={reauthWithLichess}
        />
      ) : (
        <DeleteAccountCard email={email} onRequest={requestDeletion} />
      )}
    </div>
  );
}
