import { CARD_STATE } from "./fsrs";

export type QueueCandidate = {
  cardId: string;
  pillar: string;
  /** 0 New, 1 Learning, 2 Review, 3 Relearning. */
  state: 0 | 1 | 2 | 3;
  due: Date;
};

const byDueThenId = (a: QueueCandidate, b: QueueCandidate): number =>
  a.due.getTime() - b.due.getTime() || (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0);

/**
 * Takes one card per pillar in turn (pillars sorted by name, each pillar's
 * cards in the given order) until every pillar is drained.
 */
function roundRobin(cards: QueueCandidate[]): QueueCandidate[] {
  const lanes = new Map<string, QueueCandidate[]>();
  for (const c of cards) {
    const lane = lanes.get(c.pillar);
    if (lane) lane.push(c);
    else lanes.set(c.pillar, [c]);
  }
  const ordered = [...lanes.keys()].toSorted().map((p) => lanes.get(p) ?? []);
  const out: QueueCandidate[] = [];
  for (let round = 0; out.length < cards.length; round++) {
    for (const lane of ordered) {
      const c = lane[round];
      if (c) out.push(c);
    }
  }
  return out;
}

/** Spreads `news` evenly through `reviews`; on a tie the review card goes first. */
function interleave(reviews: QueueCandidate[], news: QueueCandidate[]): QueueCandidate[] {
  const r = reviews.length;
  const n = news.length;
  if (n === 0) return reviews;
  if (r === 0) return news;
  // Integer positions on a common scale of 2*r*n avoid float ties.
  const slots = [
    ...reviews.map((card, i) => ({ card, key: (2 * i + 1) * n, rank: 0 })),
    ...news.map((card, j) => ({ card, key: (2 * j + 1) * r, rank: 1 })),
  ];
  slots.sort((a, b) => a.key - b.key || a.rank - b.rank);
  return slots.map((s) => s.card);
}

/**
 * Daily queue: due learning and relearning cards first (oldest due first), then
 * the remaining due cards round-robin across pillars with new cards (at most
 * `dailyNewLimit - introducedToday`) spread evenly through them, cut to `limit`.
 * `due` and `fresh` are expected to be pre-filtered to enabled pillars and to
 * cards due today. Pure and deterministic.
 */
export function selectQueue(input: {
  due: QueueCandidate[];
  fresh: QueueCandidate[];
  introducedToday: number;
  dailyNewLimit: number;
  now: Date;
  limit: number;
}): QueueCandidate[] {
  const nowMs = input.now.getTime();
  const sorted = [...input.due].sort(byDueThenId);
  const isLearningNow = (c: QueueCandidate) =>
    (c.state === CARD_STATE.Learning || c.state === CARD_STATE.Relearning) &&
    c.due.getTime() <= nowMs;
  const learningNow = sorted.filter(isLearningNow);
  const rest = sorted.filter((c) => !isLearningNow(c));

  const newBudget = Math.max(0, input.dailyNewLimit - input.introducedToday);
  const news = roundRobin(input.fresh).slice(0, newBudget);

  const queue = [...learningNow, ...interleave(roundRobin(rest), news)];
  return queue.slice(0, Math.max(0, input.limit));
}
