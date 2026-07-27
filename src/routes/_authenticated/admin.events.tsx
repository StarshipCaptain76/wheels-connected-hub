import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import {
  listAllEvents,
  upsertEvent,
  deleteEvent,
  type PublicEvent,
} from "@/lib/events.functions";
import { Trash2, Plus, X } from "lucide-react";

const eventsAdminQuery = queryOptions({
  queryKey: ["events", "admin"],
  queryFn: () => listAllEvents(),
});

export const Route = createFileRoute("/_authenticated/admin/events")({
  head: () => ({ meta: [{ title: "Manage Events — Just Wheels" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(eventsAdminQuery),
  component: AdminEvents,
  errorComponent: ({ error }) => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-ink/70">Access denied: {error.message}</p>
      </div>
    </SiteLayout>
  ),
});

type FormState = Partial<PublicEvent>;

function toLocalDT(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AdminEvents() {
  const { data: events } = useSuspenseQuery(eventsAdminQuery);
  const qc = useQueryClient();
  const upsert = useServerFn(upsertEvent);
  const del = useServerFn(deleteEvent);
  const [editing, setEditing] = useState<FormState | null>(null);

  async function save(form: FormState) {
    await upsert({
      data: {
        id: form.id ?? null,
        title: form.title ?? "",
        title_af: form.title_af ?? null,
        description: form.description ?? null,
        description_af: form.description_af ?? null,
        location: form.location ?? null,
        starts_at: form.starts_at ?? "",
        ends_at: form.ends_at ?? null,
        cover_url: form.cover_url ?? null,
        is_published: form.is_published ?? true,
      },
    });
    await qc.invalidateQueries({ queryKey: ["events"] });
    setEditing(null);
  }

  async function remove(id: string) {
    if (!confirm("Delete this event?")) return;
    await del({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["events"] });
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl tracking-wide text-ink">Manage events</h1>
            <p className="mt-1 text-sm text-ink/60">
              Add or edit club events. Google Calendar entries appear on /events automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing({ is_published: true, starts_at: new Date().toISOString() })}
            className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper"
          >
            <Plus className="h-4 w-4" /> New event
          </button>
        </div>

        <ul className="mt-6 space-y-3">
          {events.map((e) => (
            <li key={e.id} className="flex gap-4 rounded-lg border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--color-ink)]">
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-wider text-primary">
                  {e.is_published ? "Published" : "Hidden"} · {new Date(e.starts_at).toLocaleString()}
                </div>
                <p className="font-display text-lg text-ink">{e.title}</p>
                <p className="line-clamp-1 text-sm text-ink/70">{e.location ?? ""}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => setEditing(e)} className="rounded border-2 border-ink bg-paper px-3 py-1 text-xs font-bold uppercase">
                  Edit
                </button>
                <button type="button" onClick={() => remove(e.id)} className="rounded border-2 border-primary bg-primary p-2 text-paper">
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (ev) => {
          ev.preventDefault();
          setBusy(true);
          try {
            await onSave(form);
          } finally {
            setBusy(false);
          }
        }}
        className="w-full max-w-lg space-y-3 rounded-2xl border-2 border-ink bg-paper p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">{form.id ? "Edit event" : "New event"}</h2>
          <button type="button" onClick={onClose} className="rounded-full border-2 border-ink p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
        <Field label="Title (EN)">
          <input required value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} className={input} />
        </Field>
        <Field label="Title (AF)">
          <input value={form.title_af ?? ""} onChange={(e) => set("title_af", e.target.value)} className={input} />
        </Field>
        <Field label="Location">
          <input value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} className={input} />
        </Field>
        <Field label="Starts at">
          <input
            required
            type="datetime-local"
            value={toLocalDT(form.starts_at)}
            onChange={(e) => set("starts_at", new Date(e.target.value).toISOString())}
            className={input}
          />
        </Field>
        <Field label="Ends at">
          <input
            type="datetime-local"
            value={toLocalDT(form.ends_at)}
            onChange={(e) => set("ends_at", e.target.value ? new Date(e.target.value).toISOString() : null)}
            className={input}
          />
        </Field>
        <Field label="Description (EN)">
          <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} className={input} rows={3} />
        </Field>
        <Field label="Description (AF)">
          <textarea value={form.description_af ?? ""} onChange={(e) => set("description_af", e.target.value)} className={input} rows={3} />
        </Field>
        <Field label="Cover image URL">
          <input value={form.cover_url ?? ""} onChange={(e) => set("cover_url", e.target.value)} className={input} placeholder="https://..." />
        </Field>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.is_published ?? true} onChange={(e) => set("is_published", e.target.checked)} />
          <span className="text-sm">Published (visible on site)</span>
        </label>
        <button type="submit" disabled={busy} className="w-full rounded-md border-2 border-ink bg-primary px-4 py-3 font-bold uppercase tracking-wider text-paper disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}

const input = "mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-ink/70">{label}</span>
      {children}
    </label>
  );
}
