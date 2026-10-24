import {
  LINE_COUNT_DEFAULT,
  createLineCountStore,
  createRepertoireArrowsStore,
} from "../lib/lines-preference";

import { createPreferenceHook } from "./use-preference";

/** How many engine lines the builder searches and draws (1 to 5, 3 by default), remembered per viewer. */
export const useLineCount = createPreferenceHook(
  createLineCountStore(() => window.localStorage),
  LINE_COUNT_DEFAULT,
);

/** Whether the repertoire's own moves are drawn on the board (on by default), remembered per viewer. */
export const useRepertoireArrows = createPreferenceHook(
  createRepertoireArrowsStore(() => window.localStorage),
  true,
);
