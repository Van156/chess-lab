/** In-memory mock data for the Midnight progress screen. */

export const streak = { current: 12, longest: 31 } as const;

export const accuracyByPillar = [
  { label: "Openings", value: 82 },
  { label: "Mistakes", value: 64 },
  { label: "Blindfold", value: 71 },
] as const;

/** Share of reviewed mistakes the user repeated, per week, oldest first. Lower is better. */
export const repeatMistakeRate = [31, 29, 28, 24, 22, 21, 18, 15] as const;

export const weakestOpenings = [
  { name: "Sicilian Najdorf", side: "Black", accuracy: 58, cards: 21 },
  { name: "Queen's Gambit Declined", side: "White", accuracy: 63, cards: 17 },
  { name: "Italian Game", side: "White", accuracy: 69, cards: 26 },
  { name: "Caro-Kann Defense", side: "Black", accuracy: 74, cards: 14 },
] as const;

export const blindfoldProgress = { bestDepth: 24, averagePeeks: 1.8, sessions: 14 } as const;

const WEEKS = 12;

/** Review heatmap: 0-4 intensity per day, oldest first, 7 days per week column. Deterministic. */
export const heatmap: readonly number[] = Array.from({ length: WEEKS * 7 }, (_, index) => {
  const base = (index * 7 + (index % 7) * 3 + Math.floor(index / 5)) % 5;
  return index >= WEEKS * 7 - streak.current ? Math.max(1, base) : base;
});
