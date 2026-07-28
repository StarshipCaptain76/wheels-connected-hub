import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listAllSponsors,
  upsertSponsor,
  deleteSponsor,
  type AdminSponsor,
} from "@/lib/sponsors.functions";
import { ImageUploadField } from "@/components/ImageUploadField";
import { TranslateButton } from "@/components/TranslateButton";
import { Trash2, Plus, X } from "lucide-react";

const TAGLINE_MAX = 200;
const DEFAULT_START = "2026-07-01";
const DEFAULT_END = "2027-07-01";

const sponsorsAdminQuery = queryOptions({
  queryKey: ["sponsors", "admin"],
  queryFn: () => listAllSponsors(),
});

export const Route = createFileRoute("/_authenticated/admin/sponsors")({
  head: () => ({ meta: [{ title: "Manage Sponsors — Just Wheels" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(sponsorsAdminQuery),
  component: AdminSponsors,
  errorComponent: ({ error }) => (
    <div className="py-20 text-center">
      <p className="text-ink/70">Access denied: {error.message}</p>
    </div>
  ),
});

type FormState = Partial<AdminSponsor>;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso + (iso.length === 10 ? "T12:00:00" : "")).toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function isExpired(ends: string | null | undefined): boolean {
  if (!ends) return false;
  const today = new Date().toISOString().slice(0, 10);
  return ends < today;
}

function AdminSponsors() {
  const { data: sponsors } = useSuspenseQuery(sponsorsAdminQuery);
  const qc = useQueryClient();
  const upsert = useServerFn(upsertSponsor);
  const del = useServerFn(deleteSponsor);
  const [editing, setEditing] = useState<FormState | null>(null);

  async function save(form: FormState) {
    if (!(form.logo_path ?? "").trim()) {
      throw new Error("Logo is required — upload an image or paste a URL");
    }
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
        billing_starts_at: form.billing_starts_at ?? null,
        billing_ends_at: form.billing_ends_at ?? null,
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
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-wide text-ink sm:text-4xl">Manage sponsors</h1>
          <p className="mt-1 text-sm text-ink/60">
            Billing window controls public visibility. After the end date the logo is hidden and admin is emailed.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing({
              is_active: true,
              sort: (sponsors.at(-1)?.sort ?? 0) + 10,
              billing_starts_at: DEFAULT_START,
              billing_ends_at: DEFAULT_END,
            })
          }
          className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-white"
        >
          <Plus className="h-4 w-4" /> New sponsor
        </button>
      </div>

      <ul className="mt-6 space-y-3">
        {sponsors.map((s) => {
          const expired = isExpired(s.billing_ends_at);
          return (
            <li
              key={s.id}
              className="flex flex-col gap-3 rounded-lg border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--color-ink)] sm:flex-row sm:gap-4"
            >
              <div className="h-20 w-20 flex-none overflow-hidden rounded border-2 border-ink bg-steel/20 p-1">
                {/^https?:\/\//i.test(s.logo_path) ? (
                  <img src={s.logo_path} alt="" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-ink/50">logo</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider">
                  <span className={s.is_active && !expired ? "text-emerald-600" : "text-primary"}>
                    {expired ? "Expired" : s.is_active ? "Active" : "Hidden"}
                  </span>
                  <span className="text-ink/40">· sort {s.sort}</span>
                </div>
                <p className="font-display text-lg text-ink">{s.name}</p>
                <p className="line-clamp-1 text-sm text-ink/70">{s.tagline ?? ""}</p>
                <p className="mt-1 text-xs text-ink/55">
                  Billing: {fmtDate(s.billing_starts_at)} → {fmtDate(s.billing_ends_at)}
                </p>
              </div>
              <div className="flex flex-row gap-2 sm:flex-col">
                <button
                  type="button"
                  onClick={() => setEditing(s)}
                  className="rounded border-2 border-ink bg-paper px-3 py-1 text-xs font-bold uppercase text-ink"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="rounded border-2 border-primary bg-primary p-2 text-white"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {editing && (
        <EditModal
          state={editing}
          onSave={async (f) => {
            try {
              await save(f);
            } catch (err) {
              alert(err instanceof Error ? err.message : "Save failed");
            }
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  const remaining = max - value.length;
  return (
    <span
      className={`text-[11px] font-medium tabular-nums ${
        remaining < 0 ? "text-primary" : remaining <= 20 ? "text-amber-600" : "text-ink/40"
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
  const [form, setForm] = useState<FormState>({
    billing_starts_at: DEFAULT_START,
    billing_ends_at: DEFAULT_END,
    ...state,
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const taglineEn = form.tagline ?? "";
  const taglineAf = form.tagline_af ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4" onClick={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (taglineEn.length > TAGLINE_MAX || taglineAf.length > TAGLINE_MAX) return;
          if (
            form.billing_starts_at &&
            form.billing_ends_at &&
            form.billing_ends_at < form.billing_starts_at
          ) {
            alert("End date must be on or after the start date");
            return;
          }
          setBusy(true);
          try {
            await onSave(form);
          } finally {
            setBusy(false);
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl border-2 border-ink bg-paper p-6"
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
          trailing={
            <span className="flex items-center gap-2">
              <TranslateButton
                source={taglineAf}
                from="af"
                to="en"
                onResult={(t) => set("tagline", t.slice(0, TAGLINE_MAX))}
              />
              <CharCount value={taglineEn} max={TAGLINE_MAX} />
            </span>
          }
        >
          <input
            value={taglineEn}
            maxLength={TAGLINE_MAX}
            onChange={(e) => set("tagline", e.target.value)}
            className={input}
          />
        </Row>
        <Row
          label="Tagline (AF)"
          trailing={
            <span className="flex items-center gap-2">
              <TranslateButton
                source={taglineEn}
                from="en"
                to="af"
                onResult={(t) => set("tagline_af", t.slice(0, TAGLINE_MAX))}
              />
              <CharCount value={taglineAf} max={TAGLINE_MAX} />
            </span>
          }
        >
          <input
            value={taglineAf}
            maxLength={TAGLINE_MAX}
            onChange={(e) => set("tagline_af", e.target.value)}
            className={input}
          />
        </Row>
        <Row label="Website URL">
          <input
            value={form.website_url ?? ""}
            onChange={(e) => set("website_url", e.target.value)}
            className={input}
          />
        </Row>
        <ImageUploadField
          label="Logo"
          value={form.logo_path ?? ""}
          onChange={(v) => set("logo_path", v)}
          bucket="sponsors"
          folder="logos"
          storePath
          maxMb={3}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label="Billing start">
            <input
              type="date"
              required
              value={form.billing_starts_at ?? DEFAULT_START}
              onChange={(e) => set("billing_starts_at", e.target.value || null)}
              className={input}
            />
          </Row>
          <Row label="Billing end">
            <input
              type="date"
              required
              value={form.billing_ends_at ?? DEFAULT_END}
              onChange={(e) => set("billing_ends_at", e.target.value || null)}
              className={input}
            />
          </Row>
        </div>
        <p className="text-xs text-ink/50">
          After the end date the sponsor is hidden from the site and admin@justwheels.co.za is notified to renew.
        </p>
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
          <span className="text-sm text-ink">Active (manual override)</span>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md border-2 border-ink bg-primary px-4 py-3 font-bold uppercase tracking-wider text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}

const input = "mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-ink";

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
