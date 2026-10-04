import type { LinkProps } from "@tanstack/react-router";

import type { PrototypeVariant } from "@/shared/prototype/variants";

/** A prototype listed in the lab catalog. `to` is the (type-checked) route path, e.g. `/prototype/example`. */
export interface PrototypeEntry {
  to: LinkProps["to"];
  title: string;
  question: string;
  variants: readonly PrototypeVariant[];
}

export const exampleVariants: readonly PrototypeVariant[] = [
  { key: "A", name: "Dense table" },
  { key: "B", name: "Split list/detail" },
  { key: "C", name: "Timeline feed" },
];

export const todayHomeVariants: readonly PrototypeVariant[] = [
  { key: "A", name: "Midnight" },
  { key: "B", name: "Club" },
  { key: "C", name: "Bento" },
  { key: "D", name: "Focus" },
  { key: "E", name: "Playful" },
];

/** Screens of the Midnight app prototype; only screens that exist are listed. */
export const midnightVariants: readonly PrototypeVariant[] = [
  { key: "A", name: "Today" },
  { key: "B", name: "Review session" },
];

/** Register new prototypes here so they show up on `/prototype`. */
export const prototypes: readonly PrototypeEntry[] = [
  {
    to: "/prototype/example",
    title: "Team activity overview",
    question: "How should a team lead scan what everyone did this week?",
    variants: exampleVariants,
  },
  {
    to: "/prototype/today-home",
    title: "Today home screen",
    question: "What should the first screen after sign-in look like: palette, composition, radius?",
    variants: todayHomeVariants,
  },
  {
    to: "/prototype/midnight",
    title: "Chess Lab app (Midnight)",
    question: "Does the Midnight look hold up across every main view?",
    variants: midnightVariants,
  },
];
