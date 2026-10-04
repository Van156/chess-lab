import { createFileRoute } from "@tanstack/react-router";

import { TodayPage } from "@/features/today";

export const Route = createFileRoute("/_auth/today")({
  component: () => <TodayPage reviewTo="/review" />,
  staticData: { appShell: true },
});
