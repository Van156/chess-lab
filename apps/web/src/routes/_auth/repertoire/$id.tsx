import { createFileRoute } from "@tanstack/react-router";

import { RepertoireBuilderPage } from "@/features/repertoire";

export const Route = createFileRoute("/_auth/repertoire/$id")({
  component: RepertoireBuilderRoute,
});

function RepertoireBuilderRoute() {
  const { id } = Route.useParams();
  return <RepertoireBuilderPage id={id} />;
}
