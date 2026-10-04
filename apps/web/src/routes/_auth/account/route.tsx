import { Outlet, createFileRoute } from "@tanstack/react-router";

import { getSectionItems } from "@/app/navigation";
import { useNavContext } from "@/app/use-nav-context";
import PageHeader from "@/shared/components/layout/page-header";
import SectionNav from "@/shared/components/layout/section-nav";

/**
 * Personal account area under `_auth`; it opts into the app shell itself.
 */
export const Route = createFileRoute("/_auth/account")({
  component: AccountLayout,
  staticData: { appShell: true },
});

function AccountLayout() {
  const navContext = useNavContext();
  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <PageHeader title="Account settings" />
      <SectionNav label="Account settings" items={getSectionItems("account", navContext)} />
      <Outlet />
    </div>
  );
}
