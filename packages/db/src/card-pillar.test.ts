import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, test } from "bun:test";

import { cardPillar, cardPillarSql } from "./card-pillar";

describe("cardPillar", () => {
  test("a card with a mistake source is a Mistakes card", () => {
    expect(cardPillar({ mistakeId: "m1", repertoirePositionId: null })).toBe("mistakes");
  });

  test("a card with a repertoire position source is a Repertoire card", () => {
    expect(cardPillar({ mistakeId: null, repertoirePositionId: "p1" })).toBe("repertoire");
  });

  test("a card with no source violates the invariant", () => {
    expect(() => cardPillar({ mistakeId: null, repertoirePositionId: null })).toThrow();
  });

  test("the SQL helper derives the same pillar from the FK columns", () => {
    const { sql: text } = new PgDialect().sqlToQuery(cardPillarSql);
    expect(text).toContain(`"card"."mistake_id" is not null`);
    expect(text).toContain("'mistakes'");
    expect(text).toContain(`"card"."repertoire_position_id" is not null`);
    expect(text).toContain("'repertoire'");
  });
});
