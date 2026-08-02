import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  listAllMembers,
  updateMemberStatus,
  setAdminRole,
  approveAllPendingMembers,
  type AdminMember,
} from "@/lib/admin-members.functions";
import { Search, Shield, CheckCheck } from "lucide-react";

const membersQuery = queryOptions({
  queryKey: ["admin", "members"],
  queryFn: () => listAllMembers(),
  retry: 1,
});

export const Route = createFileRoute("/_authenticated/admin/members")({
  head: () => ({
    meta: [{ title: "Members — Admin — Just Wheels" }, { name: "robots", content: "noindex" }],
  }),
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(membersQuery);
    } catch (e) {
      // Let the page render; component will surface the error via query
      console.error("[admin/members] loader", e);
    }
  },
  component: AdminMembersPage,
  errorComponent: ({ error, reset }) => (
    <div className="rounded-xl border-2 border-primary bg-primary/10 p-6">
      <h1 className="font-display text-2xl text-ink">Members failed to load</h1>
      <p className="mt-2 text-sm text-ink/80">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-white"
      >
        Try again
      </button>
      <p className="mt-3 text-xs text-ink/50">
        If this keeps happening, ensure <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> is set
        in Vercel and your account has the admin role.
      </p>
    </div>
  ),
});

function AdminMembersPage() {
  const { data: members } = useSuspenseQuery(membersQuery);
  const qc = useQueryClient();
  const setStatus = useServerFn(updateMemberStatus);
  const setRole = useServerFn(setAdminRole);
  const approveAll = useServerFn(approveAllPendingMembers);

  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => members.filter((m: AdminMember) => m.membership_status === "pending").length,
    [members],
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = !q
      ? members
      : members.filter((m: AdminMember) =>
          [m.display_name, m.email, m.town, String(m.member_number)]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
        );
    const byNumberDesc = (a: AdminMember, b: AdminMember) => b.member_number - a.member_number;
    const admins = base.filter((m: AdminMember) => m.is_admin).sort(byNumberDesc);
    const rest = base.filter((m: AdminMember) => !m.is_admin);
    return {
      pending: rest.filter((m) => m.membership_status === "pending").sort(byNumberDesc),
      members: rest.filter((m) => m.membership_status !== "pending").sort(byNumberDesc),
      admins,
    };
  }, [members, query]);

  const totalShown = groups.pending.length + groups.members.length + groups.admins.length;


  async function run(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["admin", "members"] });
      await qc.invalidateQueries({ queryKey: ["featured-member"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl tracking-wide text-ink">Members</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pendingCount === 0 || busyId === "__all__"}
            onClick={() => run("__all__", () => approveAll({}))}
            className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" />
            {busyId === "__all__"
              ? "Approving…"
              : `Approve all pending${pendingCount ? ` (${pendingCount})` : ""}`}
          </button>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, town, number…"
              className="w-64 rounded-md border-2 border-ink bg-paper py-2 pl-8 pr-3 text-sm text-ink"
            />
          </div>
        </div>
      </div>


      {error && (
        <p className="mt-3 rounded border-2 border-primary bg-primary/10 px-3 py-2 text-sm text-primary">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border-2 border-ink">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-black text-white">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">#</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">Member</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">Contact</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">Status</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">Admin</th>
            </tr>
          </thead>
          <tbody>
            {groups.pending.length > 0 && (
              <SectionRow label={`Pending approval (${groups.pending.length})`} />
            )}
            {groups.pending.map(renderRow)}

            {groups.members.length > 0 && (
              <SectionRow label={`Members (${groups.members.length})`} />
            )}
            {groups.members.map(renderRow)}

            {groups.admins.length > 0 && (
              <tr className="border-t-2 border-ink bg-ink/5">
                <td colSpan={5} className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setAdminsOpen((v) => !v)}
                    className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink"
                  >
                    {adminsOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Admins ({groups.admins.length})
                  </button>
                </td>
              </tr>
            )}
            {adminsOpen && groups.admins.map(renderRow)}

            {totalShown === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-ink/50">
                  No members match.
                </td>
              </tr>
            )}
          </tbody>

        </table>
      </div>
    </div>
  );
}
