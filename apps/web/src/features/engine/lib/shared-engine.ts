import { createEngineClient, createWorkerTransport } from "./engine-client";

/** Shared client: the worker is created on the first `analyse` call, not at import time. */
export const engine = createEngineClient({ createTransport: () => createWorkerTransport() });
