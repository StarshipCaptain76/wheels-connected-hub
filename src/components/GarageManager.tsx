import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyGarage,
  upsertGarageVehicle,
  deleteGarageVehicle,
  deleteGaragePhoto,
  updateMyAvatar,
  type GarageVehicle,
  type GaragePhoto,
} from "@/lib/garage.functions";
import { TranslateButton } from "@/components/TranslateButton";
import { Plus, Trash2, X, Upload, Star, Loader2, Car, IdCard, ImageIcon } from "lucide-react";

const STORY_MAX = 4000;
const MAX_PHOTO_MB = 6;

function storageErrorMessage(msg: string): string {
  if (msg.includes("Bucket not found")) return "Bucket 'garage' missing — run the SQL setup";
  if (msg.includes("row-level security") || msg.includes("policy") || msg.includes("403"))
    return "Upload blocked by storage policy — re-run the garage SQL policies";
  if (msg.includes("mime") || msg.includes("not allowed"))
    return "File type not allowed — use JPG, PNG or WebP";
  return msg;
}

async function publicOrSignedUrl(path: string): Promise<string> {
  const { data: pub } = supabase.storage.from("garage").getPublicUrl(path);
  if (pub?.publicUrl) return pub.publicUrl;
  const { data: signed, error } = await supabase.storage
    .from("garage")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (error) console.warn("sign url", error);
  return signed?.signedUrl ?? pub?.publicUrl ?? "";
}

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
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["garage", "me"] });
    await qc.invalidateQueries({ queryKey: ["profile", "me"] });
  }

  async function setAsCardPhoto(url: string) {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      if (!url) throw new Error(lang === "af" ? "Geen foto nie" : "No photo URL");
      await avatarFn({ data: { avatar_url: url } });
      await refresh();
      setOkMsg(lang === "af" ? "Lidkaart-foto opgedateer" : "Member card photo updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set card photo");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(file: File) {
    setAvatarBusy(true);
    setError(null);
    setOkMsg(null);
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
      const path = `${userId}/avatar-${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage.from("garage").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || "image/jpeg",
      });
      if (upErr) throw new Error(storageErrorMessage(upErr.message));

      const url = await publicOrSignedUrl(path);
      if (!url) throw new Error("Upload ok but could not resolve public URL");
      await avatarFn({ data: { avatar_url: url } });
      await refresh();
      setOkMsg(lang === "af" ? "Foto gelaai" : "Photo uploaded");
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
      await upsertFn({
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
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

  /** Client-side storage + DB insert — avoids silent server-fn failures. */
  async function uploadPhotos(vehicleId: string, files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    setOkMsg(null);
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
        const path = `${userId}/${vehicleId}/${crypto.randomUUID()}.${ext}`;

        const { error: upErr } = await supabase.storage.from("garage").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "image/jpeg",
        });
        if (upErr) {
          console.error("garage upload", upErr);
          failures.push(`${file.name}: ${storageErrorMessage(upErr.message)}`);
          continue;
        }

        // Insert photo row directly (RLS must allow owner insert)
        const { data: row, error: dbErr } = await supabase
          .from("garage_vehicle_photos")
          .insert({
            vehicle_id: vehicleId,
            storage_path: path,
            caption: null,
            sort: uploaded,
          })
          .select("id")
          .single();

        if (dbErr || !row) {
          console.error("garage_vehicle_photos insert", dbErr);
          failures.push(
            `${file.name}: DB ${dbErr?.message ?? "insert failed — check table RLS"}`,
          );
          // Best-effort cleanup of orphaned storage object
          await supabase.storage.from("garage").remove([path]);
          continue;
        }

        uploaded += 1;
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
      if (uploaded > 0) {
        setOkMsg(
          lang === "af"
            ? `${uploaded} foto(s) gelaai`
            : `${uploaded} photo(s) uploaded`,
        );
      }
    } catch (e) {
      console.error(e);
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
      // Client fallback delete
      const { error: dbErr } = await supabase.from("garage_vehicle_photos").delete().eq("id", id);
      if (dbErr) setError(e instanceof Error ? e.message : "Could not remove photo");
      else await refresh();
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
              ? "Laai fotos op, skryf die storie, en kies een foto vir jou lidkaart."
              : "Upload photos, tell the story, and pick one photo for your member card."}
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
        <p className="rounded border-2 border-primary bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
          {error}
        </p>
      )}
      {okMsg && (
        <p className="rounded border-2 border-ink bg-ink/5 px-3 py-2 text-sm text-ink">{okMsg}</p>
      )}

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-ink bg-paper p-4 shadow-[3px_3px_0_0_var(--color-ink)]">
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
            {lang === "af" ? "Lidkaart-foto" : "Member card photo"}
          </p>
          <p className="mt-1 text-sm text-ink/70">
            {lang === "af"
              ? "Hierdie foto verskyn op jou lidkaart. Laai op of kies uit jou garage hieronder."
              : "This photo appears on your member card. Upload here or choose from your garage below."}
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
        <ul className="space-y-6">
          {vehicles.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              lang={lang}
              busy={busy}
              cardPhotoUrl={avatarUrl}
              onEdit={() => setEditing(v)}
              onDelete={() => void removeVehicle(v.id)}
              onUpload={(files) => void uploadPhotos(v.id, files)}
              onRemovePhoto={(id) => void removePhoto(id)}
              onSetCardPhoto={(url) => void setAsCardPhoto(url)}
            />
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

function VehicleCard({
  vehicle: v,
  lang,
  busy,
  cardPhotoUrl,
  onEdit,
  onDelete,
  onUpload,
  onRemovePhoto,
  onSetCardPhoto,
}: {
  vehicle: GarageVehicle;
  lang: "en" | "af";
  busy: boolean;
  cardPhotoUrl: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onUpload: (files: FileList | null) => void;
  onRemovePhoto: (id: string) => void;
  onSetCardPhoto: (url: string) => void;
}) {
  const title = v.nickname || [v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle";
  const story = lang === "af" ? v.story_af || v.story : v.story;
  const hero = v.photos.find((p) => p.url) ?? v.photos[0];

  return (
    <li className="overflow-hidden rounded-2xl border-2 border-ink bg-paper shadow-[4px_4px_0_0_var(--color-ink)]">
      <div className="grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="relative min-h-[200px] bg-ink/10">
          {hero?.url ? (
            <img src={hero.url} alt={title} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-ink/30">
              <ImageIcon className="h-10 w-10" />
              <span className="text-xs font-bold uppercase tracking-wider">
                {lang === "af" ? "Voeg foto by" : "Add a photo"}
              </span>
            </div>
          )}
          {v.is_primary && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-primary bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-paper">
              <Star className="h-3 w-3" /> Primary
            </span>
          )}
        </div>

        <div className="flex flex-col p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-display text-2xl text-ink">{title}</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="rounded border-2 border-ink bg-paper px-3 py-1 text-xs font-bold uppercase"
              >
                {lang === "af" ? "Wysig" : "Edit"}
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded border-2 border-primary bg-primary p-1.5 text-paper"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {[v.year, v.make, v.model].filter(Boolean).length > 0 && v.nickname && (
            <p className="mt-1 text-sm text-ink/55">
              {[v.year, v.make, v.model].filter(Boolean).join(" ")}
            </p>
          )}

          {story ? (
            <p className="mt-3 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/80">{story}</p>
          ) : (
            <p className="mt-3 flex-1 text-sm italic text-ink/40">
              {lang === "af" ? "Nog geen storie nie — klik Wysig." : "No story yet — click Edit."}
            </p>
          )}

          {hero?.url && (
            <button
              type="button"
              disabled={busy || cardPhotoUrl === hero.url}
              onClick={() => onSetCardPhoto(hero.url)}
              className="mt-4 inline-flex items-center gap-2 self-start rounded-md border-2 border-ink bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-paper disabled:opacity-50"
            >
              <IdCard className="h-3.5 w-3.5" />
              {cardPhotoUrl === hero.url
                ? lang === "af"
                  ? "Op lidkaart"
                  : "On member card"
                : lang === "af"
                  ? "Gebruik op lidkaart"
                  : "Use on member card"}
            </button>
          )}
        </div>
      </div>

      <div className="border-t-2 border-ink/10 px-4 py-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ink/50">
          {lang === "af" ? "Foto-biblioteek" : "Photo library"} · {v.photos.length}/8
        </p>
        <div className="flex flex-wrap gap-2">
          {v.photos.map((p: GaragePhoto) => (
            <div key={p.id} className="group relative">
              {p.url ? (
                <img src={p.url} alt="" className="h-20 w-20 rounded border-2 border-ink object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded border-2 border-dashed border-ink/30 text-[9px] text-ink/40">
                  no url
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center gap-1 rounded bg-ink/60 opacity-0 transition-opacity group-hover:opacity-100">
                {p.url && (
                  <button
                    type="button"
                    title={lang === "af" ? "Op lidkaart" : "Set as card photo"}
                    onClick={() => onSetCardPhoto(p.url)}
                    className="rounded-full bg-paper p-1 text-ink"
                  >
                    <IdCard className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemovePhoto(p.id)}
                  className="rounded-full bg-primary p-1 text-paper"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {cardPhotoUrl && p.url === cardPhotoUrl && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 text-[8px] font-bold uppercase text-paper">
                  card
                </span>
              )}
            </div>
          ))}
          {v.photos.length < 8 && (
            <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-ink/40 text-ink/40 hover:border-ink hover:text-ink">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  onUpload(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        <p className="mt-2 text-[10px] text-ink/40">JPG / PNG / WebP · max {MAX_PHOTO_MB}MB</p>
      </div>
    </li>
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
