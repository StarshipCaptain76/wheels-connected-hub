import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyGarage,
  upsertGarageVehicle,
  deleteGarageVehicle,
  addGaragePhoto,
  deleteGaragePhoto,
  updateMyAvatar,
  type GarageVehicle,
} from "@/lib/garage.functions";
import { TranslateButton } from "@/components/TranslateButton";
import { Plus, Trash2, X, Upload, Star, Loader2, Car } from "lucide-react";

const STORY_MAX = 4000;
const MAX_PHOTO_MB = 6;

export function GarageManager({
  avatarUrl,
  lang = "en",
}: {
  avatarUrl: string | null;
  lang?: "en" | "af";
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyGarage);
  const upsertFn = useServerFn(upsertGarageVehicle);
  const delFn = useServerFn(deleteGarageVehicle);
  const addPhotoFn = useServerFn(addGaragePhoto);
  const delPhotoFn = useServerFn(deleteGaragePhoto);
  const avatarFn = useServerFn(updateMyAvatar);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["garage", "me"],
    queryFn: () => listFn(),
  });

  const [editing, setEditing] = useState<Partial<GarageVehicle> | null>(null);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["garage", "me"] });
    await qc.invalidateQueries({ queryKey: ["profile", "me"] });
  }

  async function uploadAvatar(file: File) {
    setAvatarBusy(true);
    setError(null);
    try {
      if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|heic)$/i.test(file.name)) {
        throw new Error(lang === "af" ? "Kies 'n beeldlêer" : "Choose an image file");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error(lang === "af" ? "Maks 5MB" : "Max 5MB");
      }
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error(lang === "af" ? "Nie aangemeld nie" : "Not signed in");

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `avatars/${userId}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("garage")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type || "image/jpeg",
        });
      if (upErr) {
        console.error("garage avatar upload", upErr);
        throw new Error(
          upErr.message.includes("Bucket not found")
            ? "Storage bucket 'garage' missing — run the SQL setup"
            : upErr.message.includes("row-level security") || upErr.message.includes("policy")
              ? "Upload blocked by storage policy — run the garage SQL policies"
              : upErr.message,
        );
      }

      const { data: signed, error: signErr } = await supabase.storage
        .from("garage")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr) console.error("sign avatar", signErr);
      const url = signed?.signedUrl ?? path;
      await avatarFn({ data: { avatar_url: url } });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Avatar upload failed");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function saveVehicle(form: Partial<GarageVehicle>) {
    setBusy(true);
    setError(null);
    try {
      const res = await upsertFn({
        data: {
          id: form.id ?? null,
          make: form.make ?? null,
          model: form.model ?? null,
          year: form.year ?? null,
          nickname: form.nickname ?? null,
          story: form.story ?? null,
          story_af: form.story_af ?? null,
          is_primary: form.is_primary ?? false,
          sort: form.sort ?? 0,
        },
      });
      setEditing(null);
      await refresh();
      return res.id as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function removeVehicle(id: string) {
    if (!confirm(lang === "af" ? "Verwyder hierdie voertuig?" : "Delete this vehicle?")) return;
    setBusy(true);
    try {
      await delFn({ data: { id } });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhotos(vehicleId: string, files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error(lang === "af" ? "Nie aangemeld nie" : "Not signed in");

      let uploaded = 0;
      const failures: string[] = [];

      for (const file of Array.from(files).slice(0, 8)) {
        const isImage =
          file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic)$/i.test(file.name);
        if (!isImage) {
          failures.push(`${file.name}: not an image`);
          continue;
        }
        if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
          failures.push(`${file.name}: max ${MAX_PHOTO_MB}MB`);
          continue;
        }

        const ext =
          (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `vehicles/${userId}/${vehicleId}/${crypto.randomUUID()}.${ext}`;

        const { error: upErr } = await supabase.storage.from("garage").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "image/jpeg",
        });
        if (upErr) {
          console.error("garage vehicle upload", upErr);
          const msg = upErr.message.includes("Bucket not found")
            ? "Bucket 'garage' missing — run SQL setup"
            : upErr.message.includes("row-level security") || upErr.message.includes("policy")
              ? "Blocked by storage policy — run garage SQL policies"
              : upErr.message;
          failures.push(`${file.name}: ${msg}`);
          continue;
        }

        try {
          await addPhotoFn({ data: { vehicleId, storage_path: path, caption: null } });
          uploaded += 1;
        } catch (e) {
          failures.push(
            `${file.name}: ${e instanceof Error ? e.message : "DB insert failed"}`,
          );
        }
      }

      await refresh();

      if (failures.length && uploaded === 0) {
        throw new Error(failures.join(" · "));
      }
      if (failures.length) {
        setError(
          (lang === "af" ? "Sommige foto's het misluk: " : "Some photos failed: ") +
            failures.join(" · "),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(id: string) {
    setBusy(true);
    try {
      await delPhotoFn({ data: { id } });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl tracking-wide text-ink">My garage</h2>
          <p className="mt-1 text-sm text-ink/60">
            {lang === "af"
              ? "Jou foto, jou wiele, jou stories. As jy featured word, verskyn dit hier."
              : "Your photo, your wheels, your stories. When you're featured, this is what the club sees."}
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing({
              make: "",
              model: "",
              nickname: "",
              story: "",
              is_primary: vehicles.length === 0,
              sort: vehicles.length,
            })
          }
          className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper"
        >
          <Plus className="h-4 w-4" />
          {lang === "af" ? "Voeg voertuig by" : "Add vehicle"}
        </button>
      </div>

      {error && (
        <p className="rounded border-2 border-primary bg-primary/10 px-3 py-2 text-sm text-primary">{error}</p>
      )}

      <div className="flex items-center gap-4 rounded-2xl border-2 border-ink bg-paper p-4 shadow-[3px_3px_0_0_var(--color-ink)]">
        <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-ink bg-ink/10">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-ink/30">
              <Car className="h-8 w-8" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-ink/60">
            {lang === "af" ? "My foto" : "My picture"}
          </p>
          <p className="mt-1 text-sm text-ink/70">
            {lang === "af"
              ? "Word op jou lidprofiel en featured-blok gewys."
              : "Shown on your member profile and when you're featured."}
          </p>
          <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border-2 border-ink bg-paper px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-ink/5">
            {avatarBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {lang === "af" ? "Laai foto" : "Upload photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={avatarBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAvatar(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {isLoading ? (
        <p className="text-ink/50">{lang === "af" ? "Laai…" : "Loading…"}</p>
      ) : vehicles.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-ink/30 bg-ink/5 px-6 py-12 text-center">
          <Car className="mx-auto h-8 w-8 text-ink/30" />
          <p className="mt-2 font-display text-xl text-ink/50">
            {lang === "af" ? "Nog niks in die garage nie" : "Nothing in the garage yet"}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {vehicles.map((v) => (
            <li key={v.id} className="overflow-hidden rounded-2xl border-2 border-ink bg-paper shadow-[4px_4px_0_0_var(--color-ink)]">
              <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {v.is_primary && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        <Star className="h-3 w-3" /> Primary
                      </span>
                    )}
                    <h3 className="font-display text-xl text-ink">
                      {v.nickname || [v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle"}
                    </h3>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing(v)} className="rounded border-2 border-ink bg-paper px-3 py-1 text-xs font-bold uppercase">
                    {lang === "af" ? "Wysig" : "Edit"}
                  </button>
                  <button type="button" onClick={() => removeVehicle(v.id)} className="rounded border-2 border-primary bg-primary p-1.5 text-paper">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {(lang === "af" ? v.story_af || v.story : v.story) && (
                <p className="border-t border-ink/10 px-4 py-3 text-sm whitespace-pre-wrap text-ink/80">
                  {lang === "af" ? v.story_af || v.story : v.story}
                </p>
              )}
              <div className="border-t border-ink/10 px-4 py-3">
                <div className="mb-2 flex flex-wrap gap-2">
                  {v.photos.map((p) => (
                    <div key={p.id} className="relative">
                      <img src={p.url} alt="" className="h-20 w-20 rounded border-2 border-ink object-cover" />
                      <button type="button" onClick={() => removePhoto(p.id)} className="absolute -right-1.5 -top-1.5 rounded-full border border-ink bg-primary p-0.5 text-paper">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-ink/40 text-ink/40 hover:border-ink hover:text-ink">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={busy}
                      onChange={(e) => {
                        void uploadPhotos(v.id, e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <p className="text-[10px] text-ink/40">JPG / PNG / WebP · max {MAX_PHOTO_MB}MB each</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <VehicleModal
          state={editing}
          busy={busy}
          lang={lang}
          onClose={() => setEditing(null)}
          onSave={async (form) => {
            await saveVehicle(form);
          }}
        />
      )}
    </section>
  );
}

function VehicleModal({
  state,
  busy,
  lang,
  onClose,
  onSave,
}: {
  state: Partial<GarageVehicle>;
  busy: boolean;
  lang: "en" | "af";
  onClose: () => void;
  onSave: (s: Partial<GarageVehicle>) => Promise<void>;
}) {
  const [form, setForm] = useState(state);
  const set = <K extends keyof GarageVehicle>(k: K, v: GarageVehicle[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          await onSave(form);
        }}
        className="w-full max-w-lg space-y-3 rounded-2xl border-2 border-ink bg-paper p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl text-ink">
            {form.id
              ? lang === "af"
                ? "Wysig voertuig"
                : "Edit vehicle"
              : lang === "af"
                ? "Nuwe voertuig"
                : "New vehicle"}
          </h3>
          <button type="button" onClick={onClose} className="rounded-full border-2 border-ink p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={lang === "af" ? "Jaar" : "Year"}>
            <input
              type="number"
              value={form.year ?? ""}
              onChange={(e) => set("year", e.target.value ? Number(e.target.value) : null)}
              className={inp}
            />
          </Field>
          <Field label={lang === "af" ? "Maak" : "Make"}>
            <input value={form.make ?? ""} onChange={(e) => set("make", e.target.value)} className={inp} />
          </Field>
          <Field label="Model">
            <input value={form.model ?? ""} onChange={(e) => set("model", e.target.value)} className={inp} />
          </Field>
        </div>

        <Field label={lang === "af" ? "Bynaam" : "Nickname"}>
          <input value={form.nickname ?? ""} onChange={(e) => set("nickname", e.target.value)} className={inp} />
        </Field>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Story (EN)</span>
            <TranslateButton source={form.story_af ?? ""} from="af" to="en" onResult={(t) => set("story", t)} />
          </div>
          <textarea
            value={form.story ?? ""}
            maxLength={STORY_MAX}
            onChange={(e) => set("story", e.target.value)}
            className={inp}
            rows={5}
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Story (AF)</span>
            <TranslateButton source={form.story ?? ""} from="en" to="af" onResult={(t) => set("story_af", t)} />
          </div>
          <textarea
            value={form.story_af ?? ""}
            maxLength={STORY_MAX}
            onChange={(e) => set("story_af", e.target.value)}
            className={inp}
            rows={4}
          />
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.is_primary ?? false}
            onChange={(e) => set("is_primary", e.target.checked)}
          />
          <span className="text-sm">{lang === "af" ? "Primêre ry" : "Primary ride"}</span>
        </label>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md border-2 border-ink bg-primary px-4 py-3 font-bold uppercase tracking-wider text-paper disabled:opacity-60"
        >
          {busy ? "…" : lang === "af" ? "Stoor" : "Save"}
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
