import { Flame } from "lucide-react";

import {
  accuracyByPillar,
  blindfoldProgress,
  heatmap,
  repeatMistakeRate,
  streak,
  weakestOpenings,
} from "./-midnight-progress-data";
import { cardClass, eyebrowClass, MidnightShell } from "./-midnight-shell";

const heatTone = [
  "bg-(--line)",
  "bg-[rgba(62,230,176,.3)]",
  "bg-[rgba(62,230,176,.5)]",
  "bg-[rgba(62,230,176,.75)]",
  "bg-(--accent)",
];

const TREND_WIDTH = 320;
const TREND_HEIGHT = 120;
const trendMax = Math.max(...repeatMistakeRate);
const trendPoints = repeatMistakeRate
  .map((value, index) => {
    const x = (index / (repeatMistakeRate.length - 1)) * (TREND_WIDTH - 16) + 8;
    const y = TREND_HEIGHT - 12 - (value / trendMax) * (TREND_HEIGHT - 24);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  })
  .join(" ");
const trendFirst = repeatMistakeRate[0];
const trendLast = repeatMistakeRate[repeatMistakeRate.length - 1];

/** Screen F: Progress. Static dashboard built from mock data with CSS and SVG only. */
export function ProgressScreen() {
  return (
    <MidnightShell current="F" title="Progress" subtitle="Last 12 weeks">
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="m-streak" className={cardClass}>
          <h2 id="m-streak" className={eyebrowClass}>
            Streak
          </h2>
          <p className="mt-2 flex items-center gap-3 text-5xl font-bold tracking-tight">
            <Flame className="size-10 text-(--accent)" aria-hidden />
            {streak.current} <span className="text-xl font-medium text-(--muted)">days</span>
          </p>
          <p className="mt-1 text-sm text-(--muted)">Longest streak: {streak.longest} days</p>
        </section>

        <section aria-labelledby="m-accuracy" className={cardClass}>
          <h2 id="m-accuracy" className={eyebrowClass}>
            Accuracy by pillar
          </h2>
          <ul className="mt-4 flex flex-col gap-4">
            {accuracyByPillar.map((item) => (
              <li key={item.label}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{item.label}</span>
                  <span className="font-bold text-(--accent)">{item.value}%</span>
                </div>
                <div
                  role="img"
                  aria-label={`${item.label} accuracy ${item.value}%`}
                  className="mt-1 h-3 overflow-hidden rounded-full bg-(--line)"
                >
                  <div className="h-full bg-(--accent)" style={{ width: `${item.value}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="m-trend" className={cardClass}>
          <h2 id="m-trend" className={eyebrowClass}>
            Repeat-mistake rate
          </h2>
          <p className="mt-2 text-sm text-(--muted)">
            Down from {trendFirst}% to {trendLast}% over 8 weeks. Lower is better.
          </p>
          <svg
            viewBox={`0 0 ${TREND_WIDTH} ${TREND_HEIGHT}`}
            role="img"
            aria-label={`Line chart: repeat-mistake rate fell from ${trendFirst}% to ${trendLast}% over 8 weeks`}
            className="mt-4 h-auto w-full"
          >
            <polyline
              points={trendPoints}
              fill="none"
              stroke="#3ee6b0"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </section>

        <section aria-labelledby="m-weak" className={cardClass}>
          <h2 id="m-weak" className={eyebrowClass}>
            Weakest openings
          </h2>
          <ul className="mt-4 flex flex-col divide-y divide-(--line)">
            {weakestOpenings.map((item) => (
              <li key={item.name} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="font-semibold">{item.name}</span>
                  <span className="block text-(--muted)">
                    {item.side} · {item.cards} cards
                  </span>
                </span>
                <span className="text-lg font-bold text-amber-200">{item.accuracy}%</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="m-blind" className={cardClass}>
          <h2 id="m-blind" className={eyebrowClass}>
            Blindfold
          </h2>
          <p className="mt-2 text-5xl font-bold tracking-tight">
            {blindfoldProgress.bestDepth}{" "}
            <span className="text-xl font-medium text-(--muted)">moves best depth</span>
          </p>
          <p className="mt-1 text-sm text-(--muted)">
            {blindfoldProgress.sessions} sessions · {blindfoldProgress.averagePeeks} peeks on
            average
          </p>
        </section>

        <section aria-labelledby="m-heat" className={cardClass}>
          <h2 id="m-heat" className={eyebrowClass}>
            Review activity
          </h2>
          <div
            role="img"
            aria-label="Heatmap of daily reviews over the last 12 weeks, busiest in the most recent days"
            className="mt-4 grid grid-flow-col grid-rows-7 gap-1"
          >
            {heatmap.map((level, index) => (
              <span
                // Cells are a fixed-order sequence of days and never reorder.
                key={index}
                className={`aspect-square rounded-sm ${heatTone[level]}`}
              />
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-(--muted)" aria-hidden>
            Less
            {heatTone.map((tone) => (
              <span key={tone} className={`size-3 rounded-sm ${tone}`} />
            ))}
            More
          </p>
        </section>
      </div>
    </MidnightShell>
  );
}
