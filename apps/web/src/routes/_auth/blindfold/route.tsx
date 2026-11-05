import { Outlet, createFileRoute } from "@tanstack/react-router";

import { requireFeature } from "@/app/require-feature";

/** Layout and guard for the Blindfold pillar: Today is shown instead when the flag is off (ADR-17). */
export const Route = createFileRoute("/_auth/blindfold")({
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "blindfold"),
  component: Outlet,
  staticData: { appShell: true },
});
