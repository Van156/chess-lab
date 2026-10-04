import { createFileRoute } from "@tanstack/react-router";

import { PrototypeSwitcher } from "@/shared/components/prototype/prototype-switcher";
import { variantSearch } from "@/shared/prototype/variants";

import { midnightVariants } from "./-registry";
import { MistakesScreen } from "./-midnight-screen-mistakes";
import { RepertoireScreen } from "./-midnight-screen-repertoire";
import { ReviewScreen } from "./-midnight-screen-review";
import { TodayScreen } from "./-midnight-screen-today";

/** Midnight app prototype: every main Chess Lab view in the winning Today look, one screen per variant. */
export const Route = createFileRoute("/prototype/midnight")({
  validateSearch: variantSearch(midnightVariants),
  component: MidnightPrototype,
});

function MidnightPrototype() {
  const { variant } = Route.useSearch();
  return (
    <>
      {variant === "A" && <TodayScreen />}
      {variant === "B" && <ReviewScreen />}
      {variant === "C" && <RepertoireScreen />}
      {variant === "D" && <MistakesScreen />}
      <PrototypeSwitcher variants={midnightVariants} current={variant} />
    </>
  );
}
