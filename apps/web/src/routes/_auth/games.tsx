import { createFileRoute } from "@tanstack/react-router";

import BackgroundAnalysis from "@/app/background-analysis";
import { GamesPage } from "@/features/games";

export const Route = createFileRoute("/_auth/games")({
  component: GamesRoute,
  staticData: { appShell: true },
});

function GamesRoute() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <GamesPage />
      <BackgroundAnalysis />
    </div>
  );
}
