import { createFileRoute } from "@tanstack/react-router";

import { ReviewPage } from "@/features/review";

export const Route = createFileRoute("/_auth/review")({
  component: ReviewPage,
  staticData: { appShell: true },
});
