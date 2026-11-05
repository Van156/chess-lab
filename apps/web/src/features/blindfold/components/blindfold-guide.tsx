import { cn } from "@b2c-template/ui/lib/utils";
import {
  Anchor,
  ArrowRight,
  Brain,
  ChessKing,
  ChessKnight,
  Clock,
  Crosshair,
  EyeOff,
  Footprints,
  Grid2x2,
  Lightbulb,
  ListOrdered,
  type LucideIcon,
  MoveDiagonal,
  Target,
} from "lucide-react";
import { Fragment, type ReactNode, useEffect, useState } from "react";

import { DRILL_CATALOG } from "../lib/drill-catalog";
import type { GuideIcon, GuideSection, PlanWeek } from "../lib/guide-content";
import type { DrillKind } from "../lib/questions";
import GuideDiagram from "./guide-diagram";

export type BlindfoldGuideProps = {
  sections: readonly GuideSection[];
  plan: readonly PlanWeek[];
  /** Starts a drill. When given, the "Practise with" chips become buttons. */
  onPractise?: (kind: DrillKind) => void;
};

const SECTION_ICONS: Record<GuideIcon, LucideIcon> = {
  colours: Grid2x2,
  diagonals: MoveDiagonal,
  knight: ChessKnight,
  anchor: Anchor,
  "piece-list": ListOrdered,
  checks: Crosshair,
  moves: Footprints,
  mate: ChessKing,
  techniques: Brain,
};

const PLAN_ANCHOR = "guide-plan";

const drillLabels = new Map(DRILL_CATALOG.map((drill) => [drill.kind, drill.label]));

function anchorOf(section: GuideSection): string {
  return `guide-${section.id}`;
}

function ordinal(index: number): string {
  return String(index + 1).padStart(2, "0");
}

/** Squares, square ranges and moves (`a1`, `a1-h8`, `Bxh7+`, `exd6`, `O-O-O`) set in mono. */
const NOTATION = /(?<![\w-])(O-O-O|O-O|[KQRBN]?[a-h]?x?[a-h][1-8](?:-[a-h][1-8])?[+#]?)(?![\w])/g;

function withNotation(text: string): ReactNode[] {
  return text.split(NOTATION).map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="font-mono text-[0.92em] text-foreground">
        {part}
      </span>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

/** A short "Label: rest" opening is set in bold so a list can be skimmed. */
const LEAD_IN_MAX = 34;

function Bullet({ text }: { text: string }) {
  const split = text.indexOf(": ");
  const hasLeadIn = split > 0 && split <= LEAD_IN_MAX && !text.slice(0, split).includes("(");
  return (
    <li className="flex gap-3.5">
      <span aria-hidden className="mt-[0.6rem] size-1.5 shrink-0 rounded-[2px] bg-primary/70" />
      <span className="max-w-[68ch] text-[15px] leading-[1.7] text-pretty text-foreground/85">
        {hasLeadIn ? (
          <>
            <strong className="font-semibold text-foreground">
              {withNotation(text.slice(0, split))}
            </strong>
            {withNotation(text.slice(split))}
          </>
        ) : (
          withNotation(text)
        )}
      </span>
    </li>
  );
}

function DrillChips({
  drills,
  onPractise,
}: {
  drills: readonly DrillKind[];
  onPractise?: (kind: DrillKind) => void;
}) {
  const chip =
    "inline-flex items-center gap-1.5 rounded-lg border bg-secondary px-2.5 py-1 text-[13px] font-medium text-foreground";
  return (
    <ul className="flex flex-wrap gap-1.5">
      {drills.map((kind) => {
        const label = drillLabels.get(kind) ?? kind;
        return (
          <li key={kind}>
            {onPractise ? (
              <button
                type="button"
                onClick={() => onPractise(kind)}
                aria-label={`Practise ${label}`}
                className={cn(
                  chip,
                  "group cursor-pointer outline-none hover:border-primary/50 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition-colors",
                )}
              >
                {label}
                <ArrowRight
                  aria-hidden
                  className="size-3.5 text-muted-foreground group-hover:text-primary motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
                />
              </button>
            ) : (
              <span className={chip}>{label}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Tracks which anchor is in view, for the table of contents. Browser only; a no-op on the server. */
function useActiveAnchor(anchors: readonly string[]): string | undefined {
  const [active, setActive] = useState<string | undefined>(anchors[0]);
  const key = anchors.join(" ");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const elements = key
      .split(" ")
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
        const first = elements.find((element) => visible.get(element.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-15% 0px -55% 0px" },
    );
    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [key]);
  return active;
}

function TableOfContents({
  sections,
  hasPlan,
  active,
}: {
  sections: readonly GuideSection[];
  hasPlan: boolean;
  active: string | undefined;
}) {
  const items = [
    ...sections.map((section, index) => ({
      href: anchorOf(section),
      label: section.title,
      number: ordinal(index),
    })),
    ...(hasPlan
      ? [{ href: PLAN_ANCHOR, label: "Training plan", number: ordinal(sections.length) }]
      : []),
  ];
  return (
    <nav aria-label="Guide contents" className="-mx-4 lg:sticky lg:top-6 lg:mx-0 lg:self-start">
      <p className="mb-2 hidden px-3 text-[13px] font-medium text-muted-foreground lg:block">
        On this page
      </p>
      <ol className="flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:flex-col lg:gap-0.5 lg:overflow-visible lg:p-0">
        {items.map((item) => {
          const current = item.href === active;
          return (
            <li key={item.href} className="shrink-0 snap-start">
              <a
                href={`#${item.href}`}
                aria-current={current ? "location" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-full border px-3 py-1.5 text-[13px] whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition-colors",
                  "lg:rounded-lg lg:border-transparent lg:py-1.5 lg:text-sm lg:whitespace-normal",
                  current &&
                    "border-primary/40 text-foreground lg:border-transparent lg:bg-secondary",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "font-mono text-[11px] tabular-nums text-muted-foreground/70",
                    current && "text-primary",
                  )}
                >
                  {item.number}
                </span>
                {item.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function GuideCard({
  section,
  index,
  onPractise,
}: {
  section: GuideSection;
  index: number;
  onPractise?: (kind: DrillKind) => void;
}) {
  const Icon = SECTION_ICONS[section.icon];
  const titleId = `${anchorOf(section)}-title`;
  return (
    <section
      id={anchorOf(section)}
      aria-labelledby={titleId}
      className="scroll-mt-6 rounded-2xl border bg-card p-5 sm:p-7"
    >
      <header>
        <div className="flex items-center gap-3.5 sm:gap-4">
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 sm:size-11"
          >
            <Icon className="size-5" />
          </span>
          <h3
            id={titleId}
            className="flex items-baseline gap-2.5 text-lg font-semibold tracking-tight"
          >
            <span aria-hidden className="font-mono text-xs font-normal text-muted-foreground">
              {ordinal(index)}
            </span>
            {section.title}
          </h3>
        </div>
        <p className="mt-3 text-[15px] leading-6 text-pretty text-muted-foreground sm:-mt-2 sm:pl-15">
          {section.summary}
        </p>
      </header>

      <p className="mt-5 flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/[0.07] px-4 py-3">
        <Lightbulb aria-hidden className="mt-0.5 size-4.5 shrink-0 text-primary" />
        <span className="text-[15px] leading-6 font-medium text-pretty text-foreground">
          <span className="sr-only">Remember: </span>
          {withNotation(section.takeaway)}
        </span>
      </p>

      {/* The diagram floats right so the bullets use the full width once they pass it. */}
      <div className="mt-6 flow-root">
        {section.diagram ? (
          <GuideDiagram
            diagram={section.diagram}
            className="mx-auto mb-6 w-full max-w-[15rem] md:float-right md:mb-3 md:ml-8 md:w-[12.5rem]"
          />
        ) : null}
        <ul className="flex flex-col gap-3">
          {section.bullets.map((bullet) => (
            <Bullet key={bullet} text={bullet} />
          ))}
        </ul>
      </div>

      {section.drills.length > 0 ? (
        <footer className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-4">
          <span className="text-[13px] text-muted-foreground">Practise with</span>
          <DrillChips drills={section.drills} onPractise={onPractise} />
        </footer>
      ) : null}
    </section>
  );
}

function PlanTimeline({
  plan,
  onPractise,
}: {
  plan: readonly PlanWeek[];
  onPractise?: (kind: DrillKind) => void;
}) {
  const minutes = plan.map((week) => week.minutes);
  const fewest = Math.min(...minutes);
  const most = Math.max(...minutes);
  const weeks = plan.length === 6 ? "Six-week" : `${plan.length}-week`;
  return (
    <section id={PLAN_ANCHOR} aria-labelledby="blindfold-plan" className="scroll-mt-6">
      <header className="flex flex-col gap-1">
        <h2 id="blindfold-plan" className="text-lg font-semibold tracking-tight">
          {weeks} training plan
        </h2>
        <p className="text-[15px] text-pretty text-muted-foreground">
          One focus a week, from{" "}
          <span className="tabular-nums">
            {fewest === most ? `${fewest}` : `${fewest} to ${most}`}
          </span>{" "}
          minutes a day. Move on when you reach the goal.
        </p>
      </header>
      <ol className="mt-6 flex flex-col">
        {plan.map((week, index) => {
          const last = index === plan.length - 1;
          return (
            <li
              key={week.week}
              className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:gap-4"
            >
              {last ? null : (
                <span
                  aria-hidden
                  className="absolute top-12 bottom-1 left-4 w-px -translate-x-1/2 bg-border sm:top-14 sm:left-5"
                />
              )}
              <span
                aria-hidden
                className="relative z-10 mt-2 grid size-8 place-items-center rounded-full border-2 border-primary/40 bg-background font-mono text-[13px] font-semibold text-primary tabular-nums sm:mt-2.5 sm:size-10 sm:text-sm"
              >
                {week.week}
              </span>
              <div className={cn("rounded-2xl border bg-card p-4 sm:p-5", !last && "mb-4")}>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <p className="text-[13px] font-medium text-muted-foreground">Week {week.week}</p>
                  <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <Clock aria-hidden className="size-3.5" />
                    <span>
                      <span className="tabular-nums">{week.minutes}</span> min a day
                    </span>
                  </p>
                </div>
                <h3 className="mt-1 text-base font-semibold tracking-tight text-pretty">
                  {week.focus}
                </h3>
                <p className="mt-1 text-sm leading-6 text-pretty text-muted-foreground">
                  {week.daily}
                </p>
                <p className="mt-3 flex items-start gap-2 text-sm leading-6">
                  <Target aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
                  <span>
                    <span className="text-muted-foreground">Goal: </span>
                    <span className="font-medium text-foreground">{week.goal}</span>
                  </span>
                </p>
                <div className="mt-4">
                  {week.drills.length === 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1 text-[13px] text-muted-foreground">
                      <EyeOff aria-hidden className="size-3.5" />
                      Away from the drills
                    </span>
                  ) : (
                    <DrillChips drills={week.drills} onPractise={onPractise} />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Training guide (presentational): a contents list, the lessons as open cards, then the weekly plan. */
export default function BlindfoldGuide({ sections, plan, onPractise }: BlindfoldGuideProps) {
  const hasPlan = plan.length > 0;
  const active = useActiveAnchor([...sections.map(anchorOf), ...(hasPlan ? [PLAN_ANCHOR] : [])]);
  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:gap-10">
      <TableOfContents sections={sections} hasPlan={hasPlan} active={active} />
      <div className="flex min-w-0 flex-col gap-12">
        <section aria-labelledby="blindfold-ideas" className="flex flex-col gap-4">
          <header className="flex flex-col gap-1">
            <h2 id="blindfold-ideas" className="text-lg font-semibold tracking-tight">
              Ideas and techniques
            </h2>
            <p className="text-[15px] text-pretty text-muted-foreground">
              Short lessons to read once and come back to. Each ends with the drills that train it.
            </p>
          </header>
          {sections.map((section, index) => (
            <GuideCard key={section.id} section={section} index={index} onPractise={onPractise} />
          ))}
        </section>
        {hasPlan ? <PlanTimeline plan={plan} onPractise={onPractise} /> : null}
      </div>
    </div>
  );
}
