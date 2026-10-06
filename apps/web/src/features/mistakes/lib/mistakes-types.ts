import type { AppRouterClient } from "@b2c-template/api/routers/index";

/** One row of `mistakes.list`. */
export type MistakeItem = Awaited<ReturnType<AppRouterClient["mistakes"]["list"]>>["items"][number];

/** What `mistakes.get` returns: the mistake plus its game (with the PGN). */
export type MistakeDetail = Awaited<ReturnType<AppRouterClient["mistakes"]["get"]>>;
