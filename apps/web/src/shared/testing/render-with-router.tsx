import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Server-renders `element` inside a real TanStack router (memory history, catch-all route), so
 * components that render `Link` produce real hrefs. Waits for the initial load first; no DOM needed.
 */
export async function renderWithRouter(element: ReactElement): Promise<string> {
  const rootRoute = createRootRoute({ component: () => element });
  const splatRoute = createRoute({ getParentRoute: () => rootRoute, path: "$" });
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/" });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, splatRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return renderToStaticMarkup(<RouterProvider router={router} />);
}
