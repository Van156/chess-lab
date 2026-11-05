import { createFileRoute } from "@tanstack/react-router";

import { MistakeDetailPage } from "@/features/mistakes";

export const Route = createFileRoute("/_auth/mistakes/$id")({
  component: MistakeDetailRoute,
});

function MistakeDetailRoute() {
  const { id } = Route.useParams();
  return <MistakeDetailPage id={id} />;
}
