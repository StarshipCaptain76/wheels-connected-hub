import { createFileRoute } from "@tanstack/react-router";
import { PollsAdminPanel } from "@/components/PollsAdminPanel";

export const Route = createFileRoute("/_authenticated/admin/polls")({
  head: () => ({
    meta: [{ title: "Polls — Admin — Just Wheels" }, { name: "robots", content: "noindex" }],
  }),
  component: PollsAdminPage,
  errorComponent: ({ error, reset }) => (
    <div className="rounded-xl border-2 border-primary bg-primary/10 p-6">
      <h1 className="font-display text-2xl text-ink">Polls failed to load</h1>
      <p className="mt-2 text-sm text-ink/80">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-white"
      >
        Try again
      </button>
      <p className="mt-3 text-xs text-ink/50">
        If this mentions a missing table, run{" "}
        <code className="font-mono">20260910150000_home_polls.sql</code> in Supabase first.
      </p>
    </div>
  ),
});

function PollsAdminPage() {
  return <PollsAdminPanel />;
}
