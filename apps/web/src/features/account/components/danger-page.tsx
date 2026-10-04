import { authClient } from "@/app/auth-client";
import { betterAuthErrorMessage } from "@/features/auth";
import Loader from "@/shared/components/feedback/loader";

import DeleteAccountCard from "./delete-account-card";

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

  return <DeleteAccountCard email={session.user.email} onRequest={requestDeletion} />;
}
