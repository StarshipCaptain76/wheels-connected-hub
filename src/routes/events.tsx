import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout for /events and /events/$id.
 * MUST render <Outlet /> — list page lives in events.index.tsx.
 */
export const Route = createFileRoute("/events")({
  component: () => <Outlet />,
});
