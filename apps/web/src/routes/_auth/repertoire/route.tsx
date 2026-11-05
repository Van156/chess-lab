import { Outlet, createFileRoute } from "@tanstack/react-router";

import { requireFeature } from "@/app/require-feature";

/** Layout and guard for the Repertoire pillar: Today is shown instead when the flag is off (ADR-17). */
export const Route = createFileRoute("/_auth/repertoire")({
  beforeLoad: ({ context }) => requireFeature(context.queryClient, "repertoire"),
  component: Outlet,
  staticData: { appShell: true },
});
