import { sql } from "drizzle-orm";

import { card } from "./schema/cards";

/** The pillars a card can belong to. Phase 2 and 3 add `repertoire` and `drills`. */
export type CardPillar = "mistakes";

/**
 * The pillar of a card, derived from which source FK is set (ADR-04). There is no `source_type`
 * column that could disagree with the FKs; this helper and {@link cardPillarSql} are the only two
 * places that know the mapping.
 */
export function cardPillar(row: { mistakeId: string | null }): CardPillar {
  if (row.mistakeId !== null) return "mistakes";
  throw new Error("card has no source: the card_exactly_one_source invariant is broken");
}

/** SQL twin of {@link cardPillar}, for filtering and grouping in queries. */
export const cardPillarSql = sql<CardPillar>`case when ${card.mistakeId} is not null then 'mistakes' end`;
