import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useMemo, useState } from "react";
import {
  listAllMembers,
  updateMemberStatus,
  setAdminRole,
  approveAllPendingMembers,
  adminUpdateMemberProfile,
  type AdminMember,
} from "@/lib/admin-members.functions";
import { Search, Shield, CheckCheck, ChevronDown, ChevronRight, Pencil } from "lucide-react";

const inputCls = "w-full rounded border-2 border-ink bg-paper px-2 py-1 text-xs text-ink";

function EditMemberRow({ member, onDone }: { member: AdminMember; onDone: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(adminUpdateMemberProfile);
  const [form, setForm] = useState({
    display_name: member.display_name ?? "",
    phone: member.phone ?? "",
    town: member.town ?? "",
    favourite_ride: member.favourite_ride ?? "",
    featured_bio: member.featured_bio ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setErr(null);
    try {
      await save({ data: { userId: member.user_id, ...form } });
      await qc.invalidateQueries({ queryKey: ["admin", "members"] });
      await qc.invalidateQueries({ queryKey: ["featured-member"] });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-t border-ink/10 bg-ink/5">
      <td colSpan={6} className="px-3 py-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className={inputCls}
            maxLength={80}
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            placeholder="Display name"
          />
          <input
            className={inputCls}
            maxLength={30}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Phone"
          />
          <input
            className={inputCls}
            maxLength={80}
            value={form.town}
            onChange={(e) => setForm({ ...form, town: e.target.value })}
            placeholder="Town"
          />
          <input
            className={inputCls}
            maxLength={120}
            value={form.favourite_ride}
            onChange={(e) => setForm({ ...form, favourite_ride: e.target.value })}
            placeholder="Favourite ride"
          />
        </div>
        <textarea
          className={`${inputCls} mt-2`}
          rows={3}
          maxLength={1200}
          value={form.featured_bio}
          onChange={(e) => setForm({ ...form, featured_bio: e.target.value })}
          placeholder="Bio (used when featured)"
        />
        {err && <p className="mt-2 text-xs text-primary">{err}</p>}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className="rounded border-2 border-ink bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded border-2 border-ink bg-paper px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-ink"
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

function SectionRow({ label }: { label: string }) {
  return (
    <tr className="border-t-2 border-ink bg-ink/5">
      <td colSpan={6} className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink">
        {label}
      </td>
    </tr>
  );
}

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
  const [adminsOpen, setAdminsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
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

  function renderRow(m: AdminMember) {
    const busy = busyId === m.user_id;
    return (
      <Fragment key={m.user_id}>
      <tr className="border-t border-ink/10 bg-paper align-top">
        <td className="px-3 py-2 font-mono text-ink/70">
          {String(m.member_number).padStart(4, "0")}
        </td>
        <td className="px-3 py-2">
          <div className="font-semibold text-ink">{m.display_name ?? "—"}</div>
          <div className="text-xs text-ink/60">{m.town ?? ""}</div>
          {m.favourite_ride && <div className="text-xs text-ink/60">🚗 {m.favourite_ride}</div>}
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
            onClick={() => setEditId(editId === m.user_id ? null : m.user_id)}
            title="Edit profile"
            className="inline-flex items-center gap-1 rounded border-2 border-ink bg-paper px-2 py-1 text-xs font-bold uppercase text-ink"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        </td>
      </tr>
      {editId === m.user_id && (
        <EditMemberRow member={m} onDone={() => setEditId(null)} />
      )}
      </Fragment>
    );
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
              <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">Edit</th>
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
                <td colSpan={6} className="px-3 py-2">
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
