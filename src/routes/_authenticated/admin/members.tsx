import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  listAllMembers,
  updateMemberStatus,
  setAdminRole,
  setFeaturedMember,
  type AdminMember,
} from "@/lib/admin-members.functions";
import { Search, Shield, Star } from "lucide-react";

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
  const setFeatured = useServerFn(setFeaturedMember);

  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m: AdminMember) =>
      [m.display_name, m.email, m.town, String(m.member_number)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [members, query]);

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
              <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">Featured</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m: AdminMember) => {
              const busy = busyId === m.user_id;
              return (
                <tr key={m.user_id} className="border-t border-ink/10 bg-paper align-top">
                  <td className="px-3 py-2 font-mono text-ink/70">
                    {String(m.member_number).padStart(4, "0")}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-ink">{m.display_name ?? "—"}</div>
                    <div className="text-xs text-ink/60">{m.town ?? ""}</div>
                    {m.favourite_ride && (
                      <div className="text-xs text-ink/60">🚗 {m.favourite_ride}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink">
                    <div>{m.email ?? "—"}</div>
                    {m.phone && <div className="text-ink/60">{m.phone}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      disabled={busy}
                      value={m.membership_status}
                      onChange={(e) =>
                        run(m.user_id, () =>
                          setStatus({
                            data: {
                              userId: m.user_id,
                              status: e.target.value as "pending" | "active" | "suspended",
                            },
                          }),
                        )
                      }
                      className="rounded border-2 border-ink bg-paper px-2 py-1 text-xs text-ink"
                    >
                      <option value="pending">pending</option>
                      <option value="active">active</option>
                      <option value="suspended">suspended</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(m.user_id, () => setRole({ data: { userId: m.user_id, isAdmin: !m.is_admin } }))
                      }
                      className={`inline-flex items-center gap-1 rounded border-2 border-ink px-2 py-1 text-xs font-bold uppercase ${
                        m.is_admin ? "bg-black text-white" : "bg-paper text-ink"
                      }`}
                    >
                      <Shield className="h-3 w-3" /> {m.is_admin ? "Admin" : "Grant"}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(m.user_id, () =>
                          setFeatured({
                            data: m.is_featured
                              ? { userId: null }
                              : { userId: m.user_id, bio: null, photoUrl: null },
                          }),
                        )
                      }
                      className={`inline-flex items-center gap-1 rounded border-2 border-ink px-2 py-1 text-xs font-bold uppercase ${
                        m.is_featured ? "bg-primary text-white" : "bg-paper text-ink"
                      }`}
                    >
                      <Star className="h-3 w-3" /> {m.is_featured ? "Featured" : "Feature"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-ink/50">
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
