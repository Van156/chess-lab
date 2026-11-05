import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { betterAuthErrorMessage } from "@/features/auth";
import Loader from "@/shared/components/feedback/loader";

import { accountFlows } from "../lib/lichess-account";
import ProfileForm from "./profile-form";

/**
 * `/account/profile` (R1.3, container). `updateUser` makes the client refresh the shared session
 * atom (`/update-user` is a session-signal path), so the user menu and this form re-render with
 * the new name.
 */
export default function ProfilePage() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Loader />;
  }
  if (!session) {
    return null;
  }

  async function saveName(name: string) {
    const { error } = await authClient.updateUser({ name });
    if (error) {
      throw new Error(betterAuthErrorMessage(error, "Could not update your name."));
    }
    toast.success("Profile updated");
  }

  const { user } = session;
  // A synthetic Lichess email is not a real address: hide it and the change-email hint.
  const email = accountFlows(user.email).changeEmail ? user.email : undefined;
  return <ProfileForm key={user.id} name={user.name} email={email} onSave={saveName} />;
}
