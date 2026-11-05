import { createFileRoute } from "@tanstack/react-router";

import { LicensesPage } from "@/features/engine";

/** Public (outside `_auth`): the engine licence and source must be reachable without signing in. */
export const Route = createFileRoute("/licenses")({
  component: LicensesPage,
});
