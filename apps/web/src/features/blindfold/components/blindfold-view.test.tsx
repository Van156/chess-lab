import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { renderWithRouter } from "@/shared/testing/render-with-router";

import { DRILL_CATALOG, DRILL_CATEGORIES } from "../lib/drill-catalog";
import { GUIDE_SECTIONS, TRAINING_PLAN } from "../lib/guide-content";
import BlindfoldDrills, { DRILL_LEVELS, DrillCard } from "./blindfold-drills";
import BlindfoldHero from "./blindfold-hero";
import {
  ACTIVE_SUMMARY,
  FIXTURE_TODAY,
  NEW_SUMMARY,
  NOT_TODAY_SUMMARY,
} from "./blindfold-hero.fixtures";
import BlindfoldView from "./blindfold-view";
import { PLAYED_STATS } from "./drill-progress.fixtures";

const noop = () => {};
const drills = <BlindfoldDrills drills={DRILL_CATALOG} onStart={noop} />;

describe("BlindfoldView", () => {
  test("offers the Drills and Guide tabs and a header", async () => {
    const html = await renderWithRouter(
      <BlindfoldView sections={GUIDE_SECTIONS} plan={TRAINING_PLAN} drillsPanel={drills} />,
    );
    expect(html).toContain("Blindfold");
    expect(html).toContain(">Guide<");
    expect(html).toContain(">Drills<");
  });

  test("shows the drills panel first by default", async () => {
    const html = await renderWithRouter(
      <BlindfoldView sections={GUIDE_SECTIONS} plan={TRAINING_PLAN} drillsPanel={drills} />,
    );
    expect(html).toContain('aria-label="Drills"');
    for (const drill of DRILL_CATALOG) {
      expect(html).toContain(drill.example);
    }
    expect(html.match(/>Start</g)).toHaveLength(DRILL_CATALOG.length);
  });

  test("can open on the guide instead", async () => {
    const html = await renderWithRouter(
      <BlindfoldView
        sections={GUIDE_SECTIONS}
        plan={TRAINING_PLAN}
        drillsPanel={drills}
        defaultTab="guide"
      />,
    );
    expect(html).not.toContain('aria-label="Drills"');
    expect(html).toContain(GUIDE_SECTIONS[0]!.title);
  });
});

describe("BlindfoldDrills", () => {
  test("groups the drills by category, in catalogue order", () => {
    const html = renderToStaticMarkup(<BlindfoldDrills drills={DRILL_CATALOG} onStart={noop} />);
    let last = -1;
    for (const category of DRILL_CATEGORIES) {
      const heading = html.indexOf(`>${category.label}<`);
      expect(heading).toBeGreaterThan(last);
      expect(html).toContain(category.description);
      for (const drill of DRILL_CATALOG.filter((entry) => entry.category === category.id)) {
        expect(html.indexOf(`>${drill.label}<`)).toBeGreaterThan(heading);
      }
      last = heading;
    }
  });

  test("gives each drill a level control and a Start button", () => {
    const html = renderToStaticMarkup(<BlindfoldDrills drills={DRILL_CATALOG} onStart={noop} />);
    const count = DRILL_CATALOG.length;
    for (const drill of DRILL_CATALOG) {
      expect(html).toContain(`aria-label="${drill.label} level"`);
    }
    for (const level of DRILL_LEVELS) {
      expect(html.match(new RegExp(`>Level ${level}<`, "g"))).toHaveLength(count);
    }
    expect(html.match(/>Half board</g)).toHaveLength(count);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(count);
    expect(html.match(/>Start</g)).toHaveLength(count);
    expect(html.match(/>Not played yet</g)).toHaveLength(count);
  });

  test("shows the record for played drills and marks the suggestion", () => {
    const html = renderToStaticMarkup(
      <BlindfoldDrills
        drills={DRILL_CATALOG}
        stats={PLAYED_STATS}
        suggestedKind="diagonals"
        onStart={noop}
      />,
    );
    expect(html).toContain(">100%<");
    expect(html).toContain(">12<");
    expect(html.match(/>Suggested</g)).toHaveLength(1);
    const played = PLAYED_STATS.filter((stat) => stat.sessions > 0).length;
    expect(html.match(/>Not played yet</g)).toHaveLength(DRILL_CATALOG.length - played);
  });

  test("Start passes the drill and the chosen level; level buttons report their level", () => {
    const onStart = mock((_kind: string, _level: number) => {});
    const onLevel = mock((_level: number) => {});
    const card = DrillCard({
      drill: DRILL_CATALOG[2]!,
      stat: undefined,
      level: 3,
      suggested: false,
      onLevel,
      onStart,
    });
    clickable(card, "Start")!.props.onClick();
    expect(onStart).toHaveBeenCalledWith("diagonals", 3);
    clickable(card, "Level 2")!.props.onClick();
    expect(onLevel).toHaveBeenCalledWith(2);
  });
});

describe("BlindfoldHero", () => {
  const suggestion = { drill: DRILL_CATALOG[5]!, lastPlayedAt: "2026-10-30T12:00:00Z" };

  test("summarises practice and continues when played today", () => {
    const html = renderToStaticMarkup(
      <BlindfoldHero
        summary={ACTIVE_SUMMARY}
        suggestion={suggestion}
        today={FIXTURE_TODAY}
        onStart={noop}
      />,
    );
    expect(html).toContain("Continue training");
    expect(html).toContain(">46<");
    expect(html).toContain("3 h 25 min");
    expect(html).toContain(">86%<");
    expect(html).toContain("16 of 28 days");
    expect(html).toContain(`aria-label="Practised on 16 of the last 28 days"`);
    expect(html.match(/<li /g)).toHaveLength(28);
    expect(html).toContain("Check spotter");
    expect(html).toContain("Last played 6 days ago");
  });

  test("invites today's drill before the first session of the day", () => {
    const html = renderToStaticMarkup(
      <BlindfoldHero
        summary={NOT_TODAY_SUMMARY}
        suggestion={suggestion}
        today={FIXTURE_TODAY}
        onStart={noop}
      />,
    );
    expect(html).toContain("Start today&#x27;s drill");
    expect(html).toContain("Up next");
  });

  test("welcomes a brand-new player", () => {
    const html = renderToStaticMarkup(
      <BlindfoldHero
        summary={NEW_SUMMARY}
        suggestion={{ drill: DRILL_CATALOG[0]!, lastPlayedAt: null }}
        today={FIXTURE_TODAY}
        onStart={noop}
      />,
    );
    expect(html).toContain("Your first session takes two minutes");
    expect(html).toContain("Start your first drill");
    expect(html).toContain("New to you");
  });

  test("shows placeholders while loading and still offers the drill", () => {
    const html = renderToStaticMarkup(
      <BlindfoldHero pending suggestion={suggestion} today={FIXTURE_TODAY} onStart={noop} />,
    );
    expect(html).toContain('data-slot="skeleton"');
    expect(html).toContain("Practice days loading");
    expect(html).toContain("Start today&#x27;s drill");
  });

  test("the call to action starts the suggestion", () => {
    const onStart = mock(() => {});
    const element = BlindfoldHero({
      summary: ACTIVE_SUMMARY,
      suggestion,
      today: FIXTURE_TODAY,
      onStart,
    });
    clickable(element, "Continue training")!.props.onClick();
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

type Node = { type: unknown; props: { children?: unknown; onClick?: () => void } };

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && "props" in value;
}

function textOf(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textOf).join("");
  return isNode(value) ? textOf(value.props.children) : "";
}

/** The first element in the tree with an `onClick` whose text starts with `text`. */
function clickable(
  root: unknown,
  text: string,
): (Node & { props: { onClick: () => void } }) | null {
  if (Array.isArray(root)) {
    for (const child of root) {
      const found = clickable(child, text);
      if (found) return found;
    }
    return null;
  }
  if (!isNode(root)) return null;
  if (typeof root.props.onClick === "function" && textOf(root.props.children).startsWith(text)) {
    return root as Node & { props: { onClick: () => void } };
  }
  return clickable(root.props.children, text);
}
