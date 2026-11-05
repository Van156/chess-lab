import { authClient } from "@/app/auth-client";
import { SelfSecurityLog, type UserAuditSearch } from "@/features/audit-log";
import Loader from "@/shared/components/feedback/loader";

import { accountFlows } from "../lib/lichess-account";
import EmailSection from "./email-section";
import PasswordSection from "./password-section";
import SessionsSection from "./sessions-section";

/** `/account/security` (R2, R3, R4, R7.1, container): composes the security sections. */
export default function SecurityPage({ search }: { search: UserAuditSearch }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Loader />;
  }
  if (!session) {
    return null;
  }

  const { user } = session;
  const flows = accountFlows(user.email);
  return (
    <div className="flex flex-col gap-6">
      {flows.changeEmail ? <EmailSection currentEmail={user.email} /> : null}
      {flows.password ? <PasswordSection email={user.email} /> : null}
      <SessionsSection />
      <SelfSecurityLog search={search} />
    </div>
  );
}
