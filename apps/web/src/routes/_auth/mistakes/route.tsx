import { Outlet, createFileRoute } from "@tanstack/react-router";

import { requireFeature } from "@/app/require-feature";

/** Layout and guard for the Mistakes pillar: Today is shown instead when the flag is off (ADR-17). */
export const Route = createFileRoute("/_auth/mistakes")({
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "mistakes"),
  component: Outlet,
  staticData: { appShell: true },
});
