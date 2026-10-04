import { createFileRoute } from "@tanstack/react-router";

import { PrototypeSwitcher } from "@/shared/components/prototype/prototype-switcher";
import { variantSearch } from "@/shared/prototype/variants";

import { todayHomeVariants } from "./-registry";
import { VariantA } from "./-today-home-variant-a";
import { VariantB } from "./-today-home-variant-b";
import { VariantC } from "./-today-home-variant-c";

/** Today home prototype: five structural takes on the first screen after sign-in. */
export const Route = createFileRoute("/prototype/today-home")({
  validateSearch: variantSearch(todayHomeVariants),
  component: TodayHomePrototype,
});

function TodayHomePrototype() {
  const { variant } = Route.useSearch();
  return (
    <>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      <PrototypeSwitcher variants={todayHomeVariants} current={variant} />
    </>
  );
}
