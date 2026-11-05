import { createFileRoute } from "@tanstack/react-router";

import { DangerPage, parseDangerSearch } from "@/features/account";

export const Route = createFileRoute("/_auth/account/danger")({
  // `?confirm=1` is where the Lichess re-auth round trip returns to reopen the confirmation step.
  validateSearch: parseDangerSearch,
  component: RouteComponent,
});

function RouteComponent() {
  return <DangerPage confirmRequested={Route.useSearch().confirm} />;
}
