import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout route for /members/* — MUST render <Outlet /> so child routes
 * (/members/card, /members/$number) actually display.
 * Page content lives in members.index.tsx.
 */
export const Route = createFileRoute("/_authenticated/members")({
  component: () => <Outlet />,
});
