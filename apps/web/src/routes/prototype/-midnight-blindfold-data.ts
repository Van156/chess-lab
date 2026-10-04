import { squaresFromFen } from "./-today-home-mock-data";

/** In-memory mock data for the Midnight blindfold screen. */

export interface BlindfoldMode {
  key: string;
  name: string;
  description: string;
}

export const blindfoldModes: readonly BlindfoldMode[] = [
  { key: "coordinates", name: "Coordinates", description: "Name the square the app calls out." },
  { key: "colors", name: "Square color", description: "Light or dark? Answer before the timer." },
  { key: "replay", name: "Replay game", description: "Replay a master game move by move." },
  { key: "engine", name: "Play engine", description: "Play a full game without seeing the board." },
];

export const blindfoldLevels = [
  { name: "Beginner", detail: "Up to 8 moves" },
  { name: "Intermediate", detail: "Up to 16 moves" },
  { name: "Advanced", detail: "Up to 30 moves" },
] as const;

export const blindfoldStats = { bestDepth: 24, bestNote: "best replay, no peeks" } as const;

/** Moves already played in the replay, in SAN. */
export const replaySeed = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"] as const;

export const replayTitle = "Italian Game replay";
export const replayFen = "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
export const replaySquares = squaresFromFen(replayFen, ["f8", "c5"]);
