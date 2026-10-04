import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { navGroups } from "@/app/navigation";
import { useNavContext } from "@/app/use-nav-context";
import { ImpersonationBanner } from "@/features/admin";
import { UserMenu } from "@/features/auth";
import { flushPendingGrades } from "@/features/review";
import AppBreadcrumbs from "@/shared/components/layout/app-breadcrumbs";
import AppShell from "@/shared/components/layout/app-shell";
import { filterNavGroups, getBreadcrumbs } from "@/shared/lib/navigation";

/**
 * Wires the presentational `AppShell` to the app: nav config, the superadmin
 * visibility context, the sidebar footer (a public Licences link, then the user menu that sends queued review grades before signing out), the breadcrumb
 * derived from the nav config and the impersonation banner. No theme toggle: v1 is dark only (ADR-21).
 */
export default function AuthenticatedShell({ children }: { children: ReactNode }) {
  const navContext = useNavContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const breadcrumbs = getBreadcrumbs(filterNavGroups(navGroups, navContext), pathname);

  return (
    <AppShell
      navGroups={navGroups}
      navContext={navContext}
      sidebarFooter={
        <>
          <Link
            to="/licenses"
            className="px-2 text-xs text-muted-foreground underline-offset-4 hover:underline group-data-[collapsible=icon]:hidden"
          >
            Licences
          </Link>
          <UserMenu variant="sidebar" beforeSignOut={flushPendingGrades} />
        </>
      }
      breadcrumb={<AppBreadcrumbs items={breadcrumbs} />}
      banner={<ImpersonationBanner />}
    >
      {children}
    </AppShell>
  );
}
