/** Anything that takes keydown listeners: `window`, or a stand-in in a test. */
export type KeydownHost = {
  addEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void;
};

/** Listens for keydown on `host` and returns the function that stops listening. */
export function bindKeydown(
  host: KeydownHost,
  handler: (event: KeyboardEvent) => void,
): () => void {
  host.addEventListener("keydown", handler);
  return () => host.removeEventListener("keydown", handler);
}
