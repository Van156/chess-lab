export type MistakesSearch = {
  /** Narrow the list to one game; set by the "View mistakes" link on the Games screen. */
  gameId?: string;
};

/** `validateSearch` of `/mistakes`: keeps a non-empty `gameId` and drops everything else. */
export function validateMistakesSearch(search: Record<string, unknown>): MistakesSearch {
  const { gameId } = search;
  return typeof gameId === "string" && gameId.length > 0 ? { gameId } : {};
}
