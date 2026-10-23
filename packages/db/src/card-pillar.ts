import { sql } from "drizzle-orm";

import { card } from "./schema/cards";

/** The pillars a card can belong to. Phase 3 adds `drills`. */
export const CARD_PILLARS = ["mistakes", "repertoire"] as const;
export type CardPillar = (typeof CARD_PILLARS)[number];

/**
 * The pillar of a card, derived from which source FK is set (ADR-04). There is no `source_type`
 * column that could disagree with the FKs; this helper and {@link cardPillarSql} are the only two
 * places that know the mapping.
 */
export function cardPillar(row: {
  mistakeId: string | null;
  repertoirePositionId: string | null;
}): CardPillar {
  if (row.mistakeId !== null) return "mistakes";
  if (row.repertoirePositionId !== null) return "repertoire";
  throw new Error("card has no source: the card_exactly_one_source invariant is broken");
}

/** SQL twin of {@link cardPillar}, for filtering and grouping in queries. */
export const cardPillarSql = sql<CardPillar>`case when ${card.mistakeId} is not null then 'mistakes' when ${card.repertoirePositionId} is not null then 'repertoire' end`;
