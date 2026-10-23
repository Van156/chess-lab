import { createFileRoute } from "@tanstack/react-router";

import { RepertoiresPage } from "@/features/repertoire";

export const Route = createFileRoute("/_auth/repertoire/")({
  component: RepertoiresPage,
});
