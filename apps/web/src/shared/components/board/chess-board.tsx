import { lazy, Suspense, useSyncExternalStore } from "react";

import { boardThemeStyle } from "./board-theme";
import type { BoardProps } from "./board-types";

const ChessBoardImpl = lazy(() => import("./chess-board-impl"));

const subscribe = () => () => {};
const isClientSnapshot = () => true;
const isServerSnapshot = () => false;

/** True after hydration or on the client; false while rendering on the server. */
function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, isClientSnapshot, isServerSnapshot);
}

/** Same-size static squares, so the layout does not shift when the library chunk arrives. */
function BoardPlaceholder() {
  return (
    <div className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-md">
      {Array.from({ length: 64 }, (_, index) => {
        const light = (Math.floor(index / 8) + index) % 2 === 0;
        return (
          <div
            key={index}
            data-placeholder-square=""
            className={light ? "bg-(--board-light)" : "bg-(--board-dark)"}
          />
        );
      })}
    </div>
  );
}

/**
 * Client-only board behind one wrapper interface. The library chunk loads lazily, so the
 * placeholder is what the server, the build and the first paint see.
 */
export default function ChessBoard(props: BoardProps) {
  const mounted = useIsClient();
  return (
    <div
      data-slot="chess-board"
      role="group"
      aria-label={props.label}
      style={boardThemeStyle}
      className="w-full touch-manipulation"
    >
      {mounted ? (
        <Suspense fallback={<BoardPlaceholder />}>
          <ChessBoardImpl {...props} />
        </Suspense>
      ) : (
        <BoardPlaceholder />
      )}
    </div>
  );
}
