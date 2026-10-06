import { authClient } from "@/app/auth-client";
import { buildExportUrls, DataExportCard } from "@/features/data-control";
import { betterAuthErrorMessage } from "@/features/auth";
import { ENV } from "@/env.public";
import Loader from "@/shared/components/feedback/loader";

import DeleteAccountCard from "./delete-account-card";

const EXPORT_URLS = buildExportUrls(ENV.VITE_SERVER_URL);

/**
 * `/account/danger` (R6, container). With `sendDeleteAccountVerification` configured, `deleteUser`
 * only emails a link; the account is deleted when it is opened (`GET /delete-user/callback`),
 * which signs the user out and redirects to `callbackURL`, the public sign-in page.
 */
export default function DangerPage() {
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

  return (
    <div className="flex flex-col gap-6">
      <DataExportCard urls={EXPORT_URLS} />
      <DeleteAccountCard email={session.user.email} onRequest={requestDeletion} />
    </div>
  );
}
