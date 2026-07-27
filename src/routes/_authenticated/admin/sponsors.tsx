import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import {
  listAllSponsors,
  upsertSponsor,
  deleteSponsor,
  type AdminSponsor,
} from "@/lib/sponsors.functions";
import { Trash2, Plus, X } from "lucide-react";

const TAGLINE_MAX = 200;

const sponsorsAdminQuery = queryOptions({
  queryKey: ["sponsors", "admin"],
  queryFn: () => listAllSponsors(),
});

export const Route = createFileRoute("/_authenticated/admin/sponsors")({
  head: () => ({ meta: [{ title: "Manage Sponsors — Just Wheels" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(sponsorsAdminQuery),
  component: AdminSponsors,
  errorComponent: ({ error }) => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-ink/70">Access denied: {error.message}</p>
      </div>
    </SiteLayout>
  ),
});

type FormState = Partial<AdminSponsor>;

function AdminSponsors() {
  const { data: sponsors } = useSuspenseQuery(sponsorsAdminQuery);
  const qc = useQueryClient();
  const upsert = useServerFn(upsertSponsor);
  const del = useServerFn(deleteSponsor);
  const [editing, setEditing] = useState<FormState | null>(null);

  async function save(form: FormState) {
    await upsert({
      data: {
        id: form.id ?? null,
        name: form.name ?? "",
        tagline: form.tagline ?? null,
        tagline_af: form.tagline_af ?? null,
        website_url: form.website_url ?? null,
        logo_path: form.logo_path ?? "",
        is_active: form.is_active ?? true,
        sort: form.sort ?? 0,
      },
    });
    await qc.invalidateQueries({ queryKey: ["sponsors"] });
    setEditing(null);
  }

  async function remove(id: string) {
    if (!confirm("Delete this sponsor?")) return;
    await del({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["sponsors"] });
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl tracking-wide text-ink">Manage sponsors</h1>
            <p className="mt-1 text-sm text-ink/60">
              Paste a public logo URL (e.g. the sponsor's own hosted logo).
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setEditing({ is_active: true, sort: (sponsors.at(-1)?.sort ?? 0) + 10 })
            }
            className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper"
          >
            <Plus className="h-4 w-4" /> New sponsor
          </button>
        </div>

        <ul className="mt-6 space-y-3">
          {sponsors.map((s) => (
            <li
              key={s.id}
              className="flex gap-4 rounded-lg border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--color-ink)]"
            >
              <div className="h-20 w-20 flex-none overflow-hidden rounded border-2 border-ink bg-steel/20 p-1">
                {/^https?:\/\//i.test(s.logo_path) ? (
                  <img src={s.logo_path} alt="" className="h-full w-full object-contain" />
                ) : (
                  <div className="text-[10px] text-ink/50">(bucket)</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-wider text-primary">
                  {s.is_active ? "Active" : "Hidden"} · sort {s.sort}
                </div>
                <p className="font-display text-lg text-ink">{s.name}</p>
                <p className="line-clamp-1 text-sm text-ink/70">{s.tagline ?? ""}</p>
                {s.website_url && (
                  <a href={s.website_url} target="_blank" rel="noreferrer" className="text-xs text-rust">
                    {s.website_url}
                  </a>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(s)}
                  className="rounded border-2 border-ink bg-paper px-3 py-1 text-xs font-bold uppercase"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="rounded border-2 border-primary bg-primary p-2 text-paper hover:opacity-90"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        {editing && <EditModal state={editing} onSave={save} onClose={() => setEditing(null)} />}
      </div>
    </SiteLayout>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  const remaining = max - value.length;
  const isLow = remaining <= 20;
  const isOver = remaining < 0;
  return (
    <span
      className={`text-[11px] font-medium tabular-nums ${
        isOver ? "text-primary" : isLow ? "text-amber-600" : "text-ink/40"
      }`}
    >
      {remaining} left
    </span>
  );
}

function EditModal({
  state,
  onSave,
  onClose,
}: {
  state: FormState;
  onSave: (s: FormState) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(state);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const taglineEn = form.tagline ?? "";
  const taglineAf = form.tagline_af ?? "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (taglineEn.length > TAGLINE_MAX || taglineAf.length > TAGLINE_MAX) return;
    setBusy(true);
    try {
      await onSave(form);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg space-y-3 rounded-2xl border-2 border-ink bg-paper p-6 shadow-[6px_6px_0_0_hsl(var(--ink))]"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">{form.id ? "Edit sponsor" : "New sponsor"}</h2>
          <button type="button" onClick={onClose} className="rounded-full border-2 border-ink p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
        <Row label="Business name">
          <input required value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} className={input} />
        </Row>
        <Row
          label="Tagline (EN)"
          trailing={<CharCount value={taglineEn} max={TAGLINE_MAX} />}
        >
          <input
            value={taglineEn}
            maxLength={TAGLINE_MAX}
            onChange={(e) => set("tagline", e.target.value)}
            className={input}
            placeholder="Short English tagline"
          />
        </Row>
        <Row
          label="Tagline (AF)"
          trailing={<CharCount value={taglineAf} max={TAGLINE_MAX} />}
        >
          <input
            value={taglineAf}
            maxLength={TAGLINE_MAX}
            onChange={(e) => set("tagline_af", e.target.value)}
            className={input}
            placeholder="Kort Afrikaanse tagline"
          />
        </Row>
        <Row label="Website URL">
          <input value={form.website_url ?? ""} onChange={(e) => set("website_url", e.target.value)} className={input} />
        </Row>
        <Row label="Logo URL (paste a public image URL)">
          <input required value={form.logo_path ?? ""} onChange={(e) => set("logo_path", e.target.value)} className={input} placeholder="https://..." />
        </Row>
        <Row label="Sort">
          <input
            type="number"
            value={form.sort ?? 0}
            onChange={(e) => set("sort", Number(e.target.value))}
            className={input}
          />
        </Row>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.is_active ?? true}
            onChange={(e) => set("is_active", e.target.checked)}
          />
          <span className="text-sm">Active (visible on site)</span>
        </label>
        <button
          type="submit"
          disabled={busy || taglineEn.length > TAGLINE_MAX || taglineAf.length > TAGLINE_MAX}
          className="w-full rounded-md border-2 border-ink bg-primary px-4 py-3 font-bold uppercase tracking-wider text-paper disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}

const input = "mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2";

function Row({
  label,
  trailing,
  children,
}: {
  label: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-ink/70">{label}</span>
        {trailing}
      </span>
      {children}
    </label>
  );
}
