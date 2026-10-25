import { createFileRoute } from "@tanstack/react-router";

import { BlindfoldPage } from "@/features/blindfold";

export const Route = createFileRoute("/_auth/blindfold/")({
  component: BlindfoldPage,
});
