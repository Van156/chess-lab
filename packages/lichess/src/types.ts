export type LichessAccount = {
  id: string;
  username: string;
  perfs?: Record<string, { rating?: number; games?: number }>;
};

export type LichessPlayer = {
  user?: { id: string; name: string };
  rating?: number;
};

/** One game from the export, restricted to the fields Chess Lab reads. */
export type LichessGame = {
  id: string;
  rated: boolean;
  variant: string;
  speed: string;
  status: string;
  createdAt: number;
  lastMoveAt?: number;
  winner?: "white" | "black";
  players: { white: LichessPlayer; black: LichessPlayer };
  opening?: { eco: string; name: string; ply?: number };
  clock?: { initial: number; increment: number; totalTime?: number };
  moves?: string;
  pgn: string;
};

export type ExplorerMove = {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating?: number;
};

export type ExplorerStats = {
  white: number;
  draws: number;
  black: number;
  moves: ExplorerMove[];
  opening?: { eco: string; name: string } | null;
};

export type ExplorerArgs = {
  fen: string;
  ratings: number[];
  speeds: string[];
  token: string;
};

export type ExportGamesArgs = {
  username: string;
  token: string;
  sinceMs: number;
  max?: number;
  signal: AbortSignal;
};

export type LichessClient = {
  account(token: string): Promise<LichessAccount>;
  exportGames(args: ExportGamesArgs): AsyncIterable<LichessGame>;
  explorer(args: ExplorerArgs): Promise<ExplorerStats>;
};

export type LichessClientDeps = {
  fetch: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  baseUrl?: string;
  explorerUrl?: string;
};

/** Lichess kept answering 429 after every allowed retry. */
export class LichessRateLimited extends Error {
  constructor(readonly retryAt: number) {
    super(`Lichess rate limit; retry after ${new Date(retryAt).toISOString()}`);
    this.name = "LichessRateLimited";
  }
}

/** The token was rejected (revoked or expired); the user must sign in with Lichess again. */
export class LichessUnauthorized extends Error {
  constructor() {
    super("Lichess rejected the access token");
    this.name = "LichessUnauthorized";
  }
}

export class LichessHttpError extends Error {
  constructor(readonly status: number) {
    super(`Lichess responded with HTTP ${status}`);
    this.name = "LichessHttpError";
  }
}

/** The response body did not have the expected shape. */
export class LichessProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LichessProtocolError";
  }
}
