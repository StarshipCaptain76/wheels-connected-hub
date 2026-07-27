import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import {
  listAllEvents,
  upsertEvent,
  deleteEvent,
  type PublicEvent,
} from "@/lib/events.functions";
import {
  listEventWaypointsAdmin,
  saveEventWaypoints,
  type EventWaypoint,
} from "@/lib/events-detail.functions";
import { geocodeAddress } from "@/lib/maps.functions";
import { Trash2, Plus, X, MapPin, ExternalLink } from "lucide-react";

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

type ExtendedEvent = PublicEvent & {
  hero_image_url?: string | null;
  details_md?: string | null;
  details_af_md?: string | null;
  destination_address?: string | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
  destination_place_id?: string | null;
};

type FormState = Partial<ExtendedEvent>;

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

  async function save(form: FormState, waypoints: Array<Partial<EventWaypoint>>) {
    const res = await upsert({
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
        hero_image_url: form.hero_image_url ?? null,
        details_md: form.details_md ?? null,
        details_af_md: form.details_af_md ?? null,
        destination_address: form.destination_address ?? null,
        destination_lat: form.destination_lat ?? null,
        destination_lng: form.destination_lng ?? null,
        destination_place_id: form.destination_place_id ?? null,
        is_published: form.is_published ?? true,
      },
    });
    await saveEventWaypoints({
      data: {
        eventId: res.id,
        waypoints: waypoints
          .filter((w) => (w.label ?? "").trim().length > 0)
          .map((w, i) => ({
            id: null,
            label: w.label!,
            label_af: w.label_af ?? null,
            address: w.address ?? null,
            lat: w.lat ?? null,
            lng: w.lng ?? null,
            place_id: w.place_id ?? null,
            meet_time: w.meet_time ?? null,
            sort: w.sort ?? i,
          })),
      },
    });
    await qc.invalidateQueries({ queryKey: ["events"] });
    await qc.invalidateQueries({ queryKey: ["event", res.id] });
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
              Add or edit club events with map, route stops, distances and RSVPs. Google Calendar entries appear on /events automatically.
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
                <Link
                  to="/events/$id"
                  params={{ id: e.id }}
                  className="inline-flex items-center gap-1 rounded border-2 border-ink bg-paper px-3 py-1 text-xs font-bold uppercase"
                >
                  View <ExternalLink className="h-3 w-3" />
                </Link>
                <button type="button" onClick={() => setEditing(e as ExtendedEvent)} className="rounded border-2 border-ink bg-paper px-3 py-1 text-xs font-bold uppercase">
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
  onSave: (s: FormState, w: Array<Partial<EventWaypoint>>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(state);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"basics" | "destination" | "details" | "stops">("basics");
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const geocode = useServerFn(geocodeAddress);

  // Load waypoints if editing
  const existingWaypoints = useQuery({
    queryKey: ["waypoints", "admin", form.id],
    enabled: !!form.id,
    queryFn: () => listEventWaypointsAdmin({ data: { eventId: form.id! } }),
  });
  const [waypoints, setWaypoints] = useState<Array<Partial<EventWaypoint>>>([]);
  useEffect(() => {
    if (existingWaypoints.data) setWaypoints(existingWaypoints.data);
  }, [existingWaypoints.data]);

  async function doGeocodeDest() {
    const q = (form.destination_address ?? form.location ?? "").trim();
    if (!q) return;
    const r = await geocode({ data: { query: q } });
    if (!r) {
      alert("No match found for that address.");
      return;
    }
    setForm((f) => ({
      ...f,
      destination_address: r.formatted,
      destination_lat: r.lat,
      destination_lng: r.lng,
      destination_place_id: r.placeId,
    }));
  }

  async function doGeocodeWaypoint(idx: number) {
    const q = (waypoints[idx].address ?? "").trim();
    if (!q) return;
    const r = await geocode({ data: { query: q } });
    if (!r) {
      alert("No match found.");
      return;
    }
    setWaypoints((ws) =>
      ws.map((w, i) => (i === idx ? { ...w, address: r.formatted, lat: r.lat, lng: r.lng, place_id: r.placeId } : w)),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (ev) => {
          ev.preventDefault();
          setBusy(true);
          try {
            await onSave(form, waypoints);
          } catch (err) {
            alert(err instanceof Error ? err.message : "Save failed");
          } finally {
            setBusy(false);
          }
        }}
        className="w-full max-w-3xl space-y-3 rounded-2xl border-2 border-ink bg-paper p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">{form.id ? "Edit event" : "New event"}</h2>
          <button type="button" onClick={onClose} className="rounded-full border-2 border-ink p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b-2 border-ink text-xs font-bold uppercase tracking-wider">
          {(["basics", "destination", "details", "stops"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-t border-2 border-b-0 px-3 py-1.5 ${tab === t ? "border-ink bg-ink text-paper" : "border-transparent text-ink/60 hover:text-ink"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "basics" && (
          <div className="space-y-3">
            <Field label="Title (EN)"><input required value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inp} /></Field>
            <Field label="Title (AF)"><input value={form.title_af ?? ""} onChange={(e) => set("title_af", e.target.value)} className={inp} /></Field>
            <Field label="Short location line (header)"><input value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} className={inp} placeholder="e.g. Stilbaai Harbour" /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Starts at">
                <input required type="datetime-local" value={toLocalDT(form.starts_at)} onChange={(e) => set("starts_at", new Date(e.target.value).toISOString())} className={inp} />
              </Field>
              <Field label="Ends at">
                <input type="datetime-local" value={toLocalDT(form.ends_at)} onChange={(e) => set("ends_at", e.target.value ? new Date(e.target.value).toISOString() : null)} className={inp} />
              </Field>
            </div>
            <Field label="Description (EN)"><textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} className={inp} rows={2} /></Field>
            <Field label="Description (AF)"><textarea value={form.description_af ?? ""} onChange={(e) => set("description_af", e.target.value)} className={inp} rows={2} /></Field>
            <Field label="Cover image URL (card thumbnail)">
              <input value={form.cover_url ?? ""} onChange={(e) => set("cover_url", e.target.value)} className={inp} placeholder="https://..." />
            </Field>
            <Field label="Hero image URL (event page)">
              <input value={form.hero_image_url ?? ""} onChange={(e) => set("hero_image_url", e.target.value)} className={inp} placeholder="https://..." />
            </Field>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_published ?? true} onChange={(e) => set("is_published", e.target.checked)} />
              <span className="text-sm">Published (visible on site)</span>
            </label>
          </div>
        )}

        {tab === "destination" && (
          <div className="space-y-3">
            <Field label="Destination address">
              <input value={form.destination_address ?? ""} onChange={(e) => set("destination_address", e.target.value)} className={inp} placeholder="Farm, town, postal code..." />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={doGeocodeDest} className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-3 py-2 text-xs font-bold uppercase">
                <MapPin className="h-3 w-3" /> Geocode
              </button>
              {form.destination_lat != null && form.destination_lng != null && (
                <span className="text-xs text-ink/60">
                  {form.destination_lat.toFixed(5)}, {form.destination_lng.toFixed(5)}
                </span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Lat (manual override)">
                <input type="number" step="any" value={form.destination_lat ?? ""} onChange={(e) => set("destination_lat", e.target.value ? Number(e.target.value) : null)} className={inp} />
              </Field>
              <Field label="Lng (manual override)">
                <input type="number" step="any" value={form.destination_lng ?? ""} onChange={(e) => set("destination_lng", e.target.value ? Number(e.target.value) : null)} className={inp} />
              </Field>
            </div>
          </div>
        )}

        {tab === "details" && (
          <div className="space-y-3">
            <p className="text-xs text-ink/60">Long-form info about the destination — history, food, what to bring. Plain text with line breaks.</p>
            <Field label="Details (EN)"><textarea value={form.details_md ?? ""} onChange={(e) => set("details_md", e.target.value)} className={inp} rows={8} /></Field>
            <Field label="Details (AF)"><textarea value={form.details_af_md ?? ""} onChange={(e) => set("details_af_md", e.target.value)} className={inp} rows={8} /></Field>
          </div>
        )}

        {tab === "stops" && (
          <div className="space-y-3">
            <p className="text-xs text-ink/60">Add meetup stops along the way. First stop = start of the route drawn on the map.</p>
            {waypoints.length === 0 && <p className="text-sm text-ink/50">No stops yet.</p>}
            <ol className="space-y-3">
              {waypoints.map((w, i) => (
                <li key={i} className="rounded-lg border-2 border-ink bg-card p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">Stop {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => setWaypoints((ws) => ws.filter((_, j) => j !== i))}
                      className="rounded border-2 border-primary bg-primary p-1 text-paper"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Label (EN)">
                      <input value={w.label ?? ""} onChange={(e) => setWaypoints((ws) => ws.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} className={inp} />
                    </Field>
                    <Field label="Label (AF)">
                      <input value={w.label_af ?? ""} onChange={(e) => setWaypoints((ws) => ws.map((x, j) => j === i ? { ...x, label_af: e.target.value } : x))} className={inp} />
                    </Field>
                  </div>
                  <Field label="Address">
                    <input value={w.address ?? ""} onChange={(e) => setWaypoints((ws) => ws.map((x, j) => j === i ? { ...x, address: e.target.value } : x))} className={inp} />
                  </Field>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => doGeocodeWaypoint(i)} className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-3 py-1.5 text-xs font-bold uppercase">
                      <MapPin className="h-3 w-3" /> Geocode
                    </button>
                    {w.lat != null && w.lng != null && (
                      <span className="text-xs text-ink/60">{w.lat.toFixed(4)}, {w.lng.toFixed(4)}</span>
                    )}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Field label="Meet time">
                      <input type="datetime-local" value={toLocalDT(w.meet_time)} onChange={(e) => setWaypoints((ws) => ws.map((x, j) => j === i ? { ...x, meet_time: e.target.value ? new Date(e.target.value).toISOString() : null } : x))} className={inp} />
                    </Field>
                    <Field label="Sort">
                      <input type="number" value={w.sort ?? i} onChange={(e) => setWaypoints((ws) => ws.map((x, j) => j === i ? { ...x, sort: Number(e.target.value) } : x))} className={inp} />
                    </Field>
                  </div>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => setWaypoints((ws) => [...ws, { label: "", sort: ws.length }])}
              className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-paper px-3 py-2 text-xs font-bold uppercase"
            >
              <Plus className="h-3 w-3" /> Add stop
            </button>
          </div>
        )}

        <button type="submit" disabled={busy} className="w-full rounded-md border-2 border-ink bg-primary px-4 py-3 font-bold uppercase tracking-wider text-paper disabled:opacity-60">
          {busy ? "Saving…" : "Save event"}
        </button>
      </form>
    </div>
  );
}

const inp = "mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-ink/70">{label}</span>
      {children}
    </label>
  );
}
