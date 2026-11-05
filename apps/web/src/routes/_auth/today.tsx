import { createFileRoute } from "@tanstack/react-router";

import BackgroundAnalysis from "@/app/background-analysis";
import { TodayPage } from "@/features/today";

export const Route = createFileRoute("/_auth/today")({
  component: TodayRoute,
  staticData: { appShell: true },
});

function TodayRoute() {
  return (
    <div className="flex flex-col gap-6">
      <TodayPage reviewTo="/review" />
      <BackgroundAnalysis />
    </div>
  );
}
