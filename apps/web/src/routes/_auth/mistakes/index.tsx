import { createFileRoute } from "@tanstack/react-router";

import { MistakesPage, validateMistakesSearch } from "@/features/mistakes";

export const Route = createFileRoute("/_auth/mistakes/")({
  validateSearch: validateMistakesSearch,
  component: MistakesRoute,
});

function MistakesRoute() {
  const { gameId } = Route.useSearch();
  return <MistakesPage gameId={gameId} />;
}
