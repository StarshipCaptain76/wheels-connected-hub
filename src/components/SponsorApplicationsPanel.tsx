import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listSponsorApplications,
  approveSponsorApplication,
  declineSponsorApplication,
  deleteSponsorApplication,
  type SponsorApplication,
} from "@/lib/sponsor-applications.functions";
import { listAllMembers } from "@/lib/admin-members.functions";
import { Check, Inbox, Trash2, X } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";

const DEFAULT_START = new Date().toISOString().slice(0, 10);
const DEFAULT_END = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
})();

type Tab = "pending" | "approved" | "declined";

export function SponsorApplicationsPanel() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const confirm = useConfirm();
  const [approving, setApproving] = useState<SponsorApplication | null>(null);

  const listFn = useServerFn(listSponsorApplications);
  const declineFn = useServerFn(declineSponsorApplication);
  const deleteFn = useServerFn(deleteSponsorApplication);

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["sponsor-applications"],
    queryFn: () => listFn(),
  });

  const counts = useMemo(
    () => ({
      pending: apps.filter((a) => a.status === "pending").length,
      approved: apps.filter((a) => a.status === "approved").length,
      declined: apps.filter((a) => a.status === "declined").length,
    }),
    [apps],
  );
  const rows = apps.filter((a) => a.status === tab);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["sponsor-applications"] });
    await qc.invalidateQueries({ queryKey: ["sponsors"] });
  }

  return (
    <section className="rounded-2xl border-2 border-ink bg-card p-5 shadow-[4px_4px_0_0_var(--color-ink)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-2xl tracking-wide text-ink">
          <Inbox className="h-5 w-5 text-primary" /> Sponsor applications
        </h2>
        <div className="flex gap-2">
          {(["pending", "approved", "declined"] as Tab[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`rounded-md border-2 border-ink px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                tab === k ? "bg-ink text-paper" : "bg-paper text-ink"
              }`}
            >
              {k} ({counts[k]})
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-ink/60">Loading applications…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">No {tab} applications.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((a) => (
            <li key={a.id} className="rounded-lg border-2 border-ink/20 bg-paper p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg text-ink">{a.business}</p>
                  <p className="text-sm text-ink/70">
                    {a.contact_name} ·{" "}
                    <a className="underline" href={`mailto:${a.email}`}>
                      {a.email}
                    </a>
                    {a.phone ? ` · ${a.phone}` : ""}
                  </p>
                  {a.website && (
                    <a
                      href={a.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary underline"
                    >
                      {a.website}
                    </a>
                  )}
                  {a.message && <p className="mt-2 text-sm text-ink/80">{a.message}</p>}
                  <p className="mt-2 text-xs text-ink/50">
                    Received {new Date(a.created_at).toLocaleDateString("en-ZA")}
                  </p>
                </div>
                <div className="flex gap-2">
                  {a.status === "pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setApproving(a)}
                        className="inline-flex items-center gap-1 rounded border-2 border-ink bg-emerald-600 px-3 py-1 text-xs font-bold uppercase text-white"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!(await confirm({ title: "Decline this application?", description: "The applicant will not become a sponsor." }))) return;
                          await declineFn({ data: { id: a.id } });
                          await refresh();
                        }}
                        className="inline-flex items-center gap-1 rounded border-2 border-ink bg-paper px-3 py-1 text-xs font-bold uppercase text-ink"
                      >
                        <X className="h-3.5 w-3.5" /> Decline
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!(await confirm({ title: "Delete this application?" }))) return;
                      await deleteFn({ data: { id: a.id } });
                      await refresh();
                    }}
                    className="rounded border-2 border-primary bg-primary p-1.5 text-white"
                    aria-label="Delete application"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {approving && (
        <ApproveModal
          application={approving}
          onClose={() => setApproving(null)}
          onDone={async () => {
            setApproving(null);
            await refresh();
          }}
        />
      )}
    </section>
  );
}

function ApproveModal({
  application,
  onClose,
  onDone,
}: {
  application: SponsorApplication;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const membersFn = useServerFn(listAllMembers);
  const approveFn = useServerFn(approveSponsorApplication);
  const { data: members = [] } = useQuery({
    queryKey: ["admin", "members"],
    queryFn: () => membersFn(),
  });

  const preMatched = members.find(
    (m) => (m.email ?? "").toLowerCase() === application.email.toLowerCase(),
  );
  const [ownerId, setOwnerId] = useState<string>(preMatched?.user_id ?? "");
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = members
    .filter((m) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (m.display_name ?? "").toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q) ||
        String(m.member_number).includes(q)
      );
    })
    .slice(0, 200);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ownerId) return;
          if (end < start) {
            alert("End date must be on or after the start date");
            return;
          }
          setBusy(true);
          try {
            await approveFn({
              data: {
                id: application.id,
                owner_user_id: ownerId,
                billing_starts_at: start,
                billing_ends_at: end,
              },
            });
            await onDone();
          } catch (err) {
            alert(err instanceof Error ? err.message : "Approval failed");
          } finally {
            setBusy(false);
          }
        }}
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border-2 border-ink bg-paper p-6"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl text-ink">Approve {application.business}</h3>
          <button type="button" onClick={onClose} className="rounded-full border-2 border-ink p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
            Assign to member
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or member number"
            className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-ink"
          />
          <select
            required
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="mt-2 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-ink"
            size={6}
          >
            <option value="">— select a member —</option>
            {filtered.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                #{m.member_number} {m.display_name ?? "(no name)"} {m.email ? `· ${m.email}` : ""}
              </option>
            ))}
          </select>
          {preMatched && (
            <p className="mt-1 text-xs text-emerald-700">
              Matched member by application email: {preMatched.display_name ?? preMatched.email}
            </p>
          )}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
              Start date
            </span>
            <input
              type="date"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-ink"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">End date</span>
            <input
              type="date"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-ink"
            />
          </label>
        </div>

        <p className="text-xs text-ink/60">
          A hidden sponsor card is created and the applicant plus the assigned member get an email
          to complete the card. Activate it on the sponsor list once the card looks right.
        </p>

        <button
          type="submit"
          disabled={busy || !ownerId}
          className="w-full rounded-md border-2 border-ink bg-primary px-4 py-3 font-bold uppercase tracking-wider text-white disabled:opacity-60"
        >
          {busy ? "Approving…" : "Approve & notify"}
        </button>
      </form>
    </div>
  );
}
