import { describe, expect, test } from "bun:test";

import { CARD_PILLARS } from "@b2c-template/db/card-pillar";
import { enabledCardPillars, parseFeatureFlags } from "./features";

describe("parseFeatureFlags", () => {
  test("defaults to the mistakes pillar only", () => {
    expect(parseFeatureFlags({})).toEqual({
      mistakes: true,
      repertoire: false,
      blindfold: false,
      progress: false,
      emailSignUp: false,
    });
  });

  test("treats an empty or blank value as the default", () => {
    expect(parseFeatureFlags({ CHESSLAB_FEATURES: "" })).toEqual(parseFeatureFlags({}));
    expect(parseFeatureFlags({ CHESSLAB_FEATURES: "  " })).toEqual(parseFeatureFlags({}));
  });

  test("parses a comma list, trimming and ignoring case", () => {
    const flags = parseFeatureFlags({ CHESSLAB_FEATURES: " Mistakes, blindfold ,PROGRESS" });
    expect(flags).toEqual({
      mistakes: true,
      repertoire: false,
      blindfold: true,
      progress: true,
      emailSignUp: false,
    });
  });

  test("an explicit list replaces the default (mistakes can be turned off)", () => {
    const flags = parseFeatureFlags({ CHESSLAB_FEATURES: "repertoire" });
    expect(flags.mistakes).toBe(false);
    expect(flags.repertoire).toBe(true);
  });

  test("ignores unknown tokens and empty segments", () => {
    const flags = parseFeatureFlags({ CHESSLAB_FEATURES: "mistakes,,teleport,drills" });
    expect(flags).toEqual(parseFeatureFlags({}));
  });

  test("emailSignUp is off by default and opt-in through the same list", () => {
    expect(parseFeatureFlags({}).emailSignUp).toBe(false);
    const flags = parseFeatureFlags({ CHESSLAB_FEATURES: "mistakes,emailSignUp" });
    expect(flags.emailSignUp).toBe(true);
    expect(flags.mistakes).toBe(true);
  });
});

describe("enabledCardPillars", () => {
  test("lists the card pillars whose flag is on", () => {
    expect(enabledCardPillars(parseFeatureFlags({}))).toEqual(["mistakes"]);
    expect(enabledCardPillars(parseFeatureFlags({ CHESSLAB_FEATURES: "blindfold" }))).toEqual([]);
  });
});

describe("CARD_PILLARS", () => {
  test("every card pillar maps to a feature flag", () => {
    const flags = parseFeatureFlags({});
    for (const pillar of CARD_PILLARS) expect(pillar in flags).toBe(true);
  });
});
