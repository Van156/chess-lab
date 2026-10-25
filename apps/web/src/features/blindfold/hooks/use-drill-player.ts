import { useRef, useState } from "react";

import {
  answerQuestion,
  elapsedMs,
  nextQuestion,
  startSession,
  type DrillSession,
} from "../lib/drill-session";
import type { Answer, DrillKind } from "../lib/questions";
import { useClock } from "./use-clock";

const SEED_RANGE = 2 ** 31;

/**
 * Owns the one drill session on screen: `null` while the picker shows. Transitions are the pure
 * functions in `drill-session`; this hook only supplies the clock and a fresh seed per session.
 * `onFinish` runs once, from the event that ends the session (never from an effect).
 */
export function useDrillPlayer({ onFinish }: { onFinish?: (session: DrillSession) => void } = {}) {
  const [session, setSession] = useState<DrillSession | null>(null);
  // The session value `next` last acted on: a double click on "Finish" must save only once.
  const advancedFrom = useRef<DrillSession | null>(null);
  const now = useClock(session !== null && session.phase !== "finished");

  return {
    session,
    elapsed: session ? elapsedMs(session, now) : 0,
    start: (kind: DrillKind, level: number) =>
      setSession(
        startSession({
          kind,
          level,
          seed: Math.floor(Math.random() * SEED_RANGE),
          now: Date.now(),
        }),
      ),
    answer: (answer: Answer) =>
      setSession((current) => (current ? answerQuestion(current, answer) : current)),
    next: () => {
      if (!session || advancedFrom.current === session) return;
      advancedFrom.current = session;
      const advanced = nextQuestion(session, Date.now());
      setSession(advanced);
      if (advanced.phase === "finished") onFinish?.(advanced);
    },
    /** Back to the picker; nothing is saved. */
    quit: () => setSession(null),
  };
}
