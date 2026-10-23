import type { RepertoireSummary } from "../lib/repertoire-types";

export const whiteRepertoire = {
  id: "r1",
  color: "white",
  name: "Open games",
  createdAt: new Date("2026-10-01T10:00:00Z"),
  updatedAt: new Date("2026-10-02T10:00:00Z"),
} satisfies RepertoireSummary;

export const blackRepertoire = {
  id: "r2",
  color: "black",
  name: "Sicilian Najdorf",
  createdAt: new Date("2026-10-03T10:00:00Z"),
  updatedAt: new Date("2026-10-03T10:00:00Z"),
} satisfies RepertoireSummary;
