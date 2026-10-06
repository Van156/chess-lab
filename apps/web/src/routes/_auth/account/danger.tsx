import { createFileRoute } from "@tanstack/react-router";
import z from "zod";

import { DangerPage } from "@/features/account";

export const Route = createFileRoute("/_auth/account/danger")({
  // `?confirm=1` is where the Lichess re-auth round trip returns to reopen the confirmation step.
  validateSearch: z.object({
    confirm: z
      .union([z.literal(1), z.literal("1")])
      .optional()
      .catch(undefined),
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <DangerPage confirmRequested={Route.useSearch().confirm !== undefined} />;
}
