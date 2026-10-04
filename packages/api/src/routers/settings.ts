import { z } from "zod";

import { protectedProcedure } from "../index";
import { getSettings, updateSettings } from "../services/settings-service";

/** Daily new-card limit bounds; 0 pauses new cards without disabling reviews. */
export const MIN_DAILY_NEW_CARDS = 0;
export const MAX_DAILY_NEW_CARDS = 200;

function isIanaTimeZone(value: string): boolean {
  if (value.length === 0 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const updateInput = z.object({
  dailyNewCardLimit: z.int().min(MIN_DAILY_NEW_CARDS).max(MAX_DAILY_NEW_CARDS).optional(),
  timeZone: z.string().refine(isIanaTimeZone, { message: "Unknown IANA time zone." }).optional(),
});

/** Per-user settings. The row is created lazily; the user id comes from the session only. */
export const settingsRouter = {
  get: protectedProcedure.handler(({ context }) =>
    getSettings(context.db, context.session.user.id),
  ),
  update: protectedProcedure.input(updateInput).handler(({ input, context }) => {
    const patch = {
      ...(input.dailyNewCardLimit === undefined
        ? {}
        : { dailyNewCardLimit: input.dailyNewCardLimit }),
      ...(input.timeZone === undefined ? {} : { timeZone: input.timeZone }),
    };
    return updateSettings(context.db, context.session.user.id, patch);
  }),
};
