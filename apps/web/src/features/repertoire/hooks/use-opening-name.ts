import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { openingName, type Opening, type OpeningBookState } from "../lib/opening-lookup";

/**
 * The opening book is a few thousand entries, so it is its own chunk: a dynamic import keeps it
 * out of the main bundle, and the query keeps the loaded module for the rest of the session.
 */
const loadOpeningBook = () =>
  import("../data/openings.generated").then((module) => module.OPENINGS);

/**
 * The opening name along a line, from the start position to the current one. `undefined` while
 * the book loads or when it cannot be loaded (the name is a nicety, so a failure is silent), and
 * `null` once the book is loaded and the line has no name yet. The states are decided by the pure
 * `openingName`; this hook only binds the book query to it.
 */
export function useOpeningName(fens: readonly string[] | null): Opening | null | undefined {
  const { data: book, isError } = useQuery({
    queryKey: ["opening-book"],
    queryFn: loadOpeningBook,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const state: OpeningBookState = useMemo(
    () => (book ? { kind: "loaded", book } : { kind: isError ? "failed" : "loading" }),
    [book, isError],
  );
  return useMemo(() => openingName(state, fens), [state, fens]);
}
