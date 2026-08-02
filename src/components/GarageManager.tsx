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
import { getMyProfile } from "@/lib/profile.functions";
import { downloadDisplayBoard } from "@/lib/display-board";
import { TranslateButton } from "@/components/TranslateButton";
import { Plus, Trash2, X, Upload, Star, Loader2, Car, IdCard, ImageIcon, FileDown } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";

/** Spec-sheet fields shown on the printable exhibition board */
export const SPEC_FIELDS: Array<{ key: keyof GarageVehicle; en: string; af: string }> = [
  { key: "built_by", en: "Built by", af: "Gebou deur" },
  { key: "engine", en: "Engine", af: "Enjin" },
  { key: "power", en: "Power", af: "Krag" },
  { key: "torque", en: "Torque", af: "Wringkrag" },
  { key: "acceleration", en: "0 – 100 km/h", af: "0 – 100 km/h" },
  { key: "quarter_mile", en: "Quarter mile", af: "Kwartmyl" },
  { key: "top_speed", en: "Top speed", af: "Topspoed" },
  { key: "fuel_economy", en: "Fuel economy", af: "Brandstofverbruik" },
  { key: "transmission", en: "Transmission", af: "Transmissie" },
  { key: "diff_ratio", en: "Diff ratio", af: "Ewenaarverhouding" },
  { key: "suspension_front", en: "Suspension front", af: "Vering voor" },
  { key: "suspension_rear", en: "Suspension rear", af: "Vering agter" },
  { key: "brakes_front", en: "Brakes front", af: "Remme voor" },
  { key: "brakes_rear", en: "Brakes rear", af: "Remme agter" },
  { key: "wheels_tyres", en: "Wheels & tyres", af: "Wiele & bande" },
  { key: "car_size", en: "Size (L x W)", af: "Grootte (L x B)" },
  { key: "car_weight", en: "Weight", af: "Gewig" },
];

const STORY_MAX = 4000;
const MAX_PHOTO_MB = 6;

function storageErrorMessage(msg: string): string {
  if (msg.includes("Bucket not found")) return "Bucket 'garage' missing — run the SQL setup";
  if (msg.includes("row-level security") || msg.includes("policy") || msg.includes("403"))
    return "Upload blocked by storage policy — re-run the permissive garage storage SQL";
  if (msg.includes("mime") || msg.includes("not allowed"))
    return "File type not allowed — use JPG, PNG or WebP";
  return msg;
}

async function publicOrSignedUrl(path: string): Promise<string> {
  const { data: signed, error } = await supabase.storage
    .from("garage")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) console.warn("sign url", error);
  return signed?.signedUrl ?? "";
}

/** Open OS file picker without relying on hidden <label> clicks. */
function pickImageFiles(multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/gif,image/*";
    input.multiple = multiple;
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", () => {
      const files = input.files ? Array.from(input.files) : [];
      document.body.removeChild(input);
      resolve(files);
    });
    // Cancel path (some browsers)
    input.addEventListener("cancel", () => {
      document.body.removeChild(input);
      resolve([]);
    });
    input.click();
  });
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

  const profileFn = useServerFn(getMyProfile);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["garage", "me"],
    queryFn: () => listFn(),
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => profileFn(),
  });

  const [editing, setEditing] = useState<Partial<GarageVehicle> | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

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

  async function uploadAvatar() {
    setAvatarBusy(true);
    setError(null);
    setOkMsg(null);
    setStatus(lang === "af" ? "Kies foto…" : "Choose photo…");
    try {
      const files = await pickImageFiles(false);
      const file = files[0];
      if (!file) {
        setStatus(null);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error(lang === "af" ? "Maks 5MB" : "Max 5MB");
      }
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error(lang === "af" ? "Nie aangemeld nie" : "Not signed in");

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      // Match path style that already worked for your existing avatar
      const path = `avatars/${userId}/${crypto.randomUUID()}.${ext}`;

      setStatus(lang === "af" ? "Laai op…" : "Uploading…");
      const { error: upErr } = await supabase.storage.from("garage").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || "image/jpeg",
      });
      if (upErr) throw new Error(storageErrorMessage(upErr.message));

      const url = await publicOrSignedUrl(path);
      if (!url) throw new Error("Upload ok but could not resolve URL");
      await avatarFn({ data: { avatar_url: url } });
      await refresh();
      setOkMsg(lang === "af" ? "Profielfoto gelaai" : "Profile photo uploaded");
      setStatus(null);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Avatar upload failed";
      setError(msg);
      setStatus(null);
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
          built_by: (form.built_by as string | null | undefined) ?? null,
          engine: (form.engine as string | null | undefined) ?? null,
          power: (form.power as string | null | undefined) ?? null,
          torque: (form.torque as string | null | undefined) ?? null,
          acceleration: (form.acceleration as string | null | undefined) ?? null,
          quarter_mile: (form.quarter_mile as string | null | undefined) ?? null,
          top_speed: (form.top_speed as string | null | undefined) ?? null,
          fuel_economy: (form.fuel_economy as string | null | undefined) ?? null,
          transmission: (form.transmission as string | null | undefined) ?? null,
          diff_ratio: (form.diff_ratio as string | null | undefined) ?? null,
          suspension_front: (form.suspension_front as string | null | undefined) ?? null,
          suspension_rear: (form.suspension_rear as string | null | undefined) ?? null,
          brakes_front: (form.brakes_front as string | null | undefined) ?? null,
          brakes_rear: (form.brakes_rear as string | null | undefined) ?? null,
          wheels_tyres: (form.wheels_tyres as string | null | undefined) ?? null,
          car_size: (form.car_size as string | null | undefined) ?? null,
          car_weight: (form.car_weight as string | null | undefined) ?? null,
          extra_notes: (form.extra_notes as string | null | undefined) ?? null,
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

  async function downloadBoard(v: GarageVehicle) {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    setStatus(lang === "af" ? "Bou vertoonbord…" : "Building display board…");
    try {
      const res = await downloadDisplayBoard({
        vehicle: v,
        owner: {
          display_name: profile?.display_name ?? null,
          member_number: profile?.member_number ?? null,
          town: profile?.town ?? null,
          avatar_url: profile?.avatar_url ?? null,
        },
        lang,
      });
      setOkMsg(
        res.lowRes
          ? lang === "af"
            ? "Bord afgelaai — die motorfoto is lae resolusie, dit mag korrelig druk."
            : "Board downloaded — the car photo is low resolution and may print grainy."
          : lang === "af"
            ? "Vertoonbord afgelaai (600 x 900 mm)"
            : "Display board downloaded (600 x 900 mm)",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Board download failed");
    } finally {
      setStatus(null);
      setBusy(false);
    }
  }

  async function removeVehicle(id: string) {
    if (!(await confirm({
      title: lang === "af" ? "Verwyder hierdie voertuig?" : "Delete this vehicle?",
      confirmLabel: lang === "af" ? "Verwyder" : "Delete",
      cancelLabel: lang === "af" ? "Kanselleer" : "Cancel",
    })))
      return;
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

  async function uploadPhotos(vehicleId: string) {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    setStatus(lang === "af" ? "Kies foto(s)…" : "Choose photo(s)…");
    try {
      const files = await pickImageFiles(true);
      if (!files.length) {
        setStatus(null);
        setBusy(false);
        return;
      }

      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error(lang === "af" ? "Nie aangemeld nie" : "Not signed in");

      let uploaded = 0;
      const failures: string[] = [];

      for (let i = 0; i < Math.min(files.length, 8); i++) {
        const file = files[i];
        setStatus(
          lang === "af"
            ? `Laai op ${i + 1}/${files.length}: ${file.name}`
            : `Uploading ${i + 1}/${files.length}: ${file.name}`,
        );

        if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
          failures.push(`${file.name}: max ${MAX_PHOTO_MB}MB`);
          continue;
        }

        const ext =
          (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        // Same root folder style as the working avatar: avatars/{userId}/...
        // Vehicles: vehicles/{userId}/{vehicleId}/{uuid}.ext
        const path = `vehicles/${userId}/${vehicleId}/${crypto.randomUUID()}.${ext}`;

        console.log("[garage] uploading", path, file.type, file.size);
        const { error: upErr } = await supabase.storage.from("garage").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "image/jpeg",
        });
        if (upErr) {
          console.error("[garage] storage error", upErr);
          failures.push(`${file.name}: ${storageErrorMessage(upErr.message)}`);
          continue;
        }

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
          console.error("[garage] db error", dbErr);
          failures.push(`${file.name}: DB ${dbErr?.message ?? "insert failed"}`);
          await supabase.storage.from("garage").remove([path]);
          continue;
        }

        uploaded += 1;
      }

      await refresh();

      if (failures.length && uploaded === 0) throw new Error(failures.join(" · "));
      if (failures.length) {
        setError(
          (lang === "af" ? "Sommige foto's het misluk: " : "Some photos failed: ") +
            failures.join(" · "),
        );
      }
      if (uploaded > 0) {
        setOkMsg(
          lang === "af" ? `${uploaded} foto(s) gelaai` : `${uploaded} photo(s) uploaded`,
        );
      }
      setStatus(null);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Photo upload failed");
      setStatus(null);
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
      {status && (
        <p className="flex items-center gap-2 rounded border-2 border-ink/20 bg-paper px-3 py-2 text-sm text-ink/70">
          <Loader2 className="h-4 w-4 animate-spin" /> {status}
        </p>
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
          <button
            type="button"
            disabled={avatarBusy}
            onClick={() => void uploadAvatar()}
            className="mt-2 inline-flex items-center gap-2 rounded-md border-2 border-ink bg-paper px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-ink/5 disabled:opacity-50"
          >
            {avatarBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {lang === "af" ? "Laai foto" : "Upload photo"}
          </button>
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
              onUpload={() => void uploadPhotos(v.id)}
              onRemovePhoto={(id) => void removePhoto(id)}
              onSetCardPhoto={(url) => void setAsCardPhoto(url)}
              onDownloadBoard={() => void downloadBoard(v)}
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
  onDownloadBoard,
}: {
  vehicle: GarageVehicle;
  lang: "en" | "af";
  busy: boolean;
  cardPhotoUrl: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onUpload: () => void;
  onRemovePhoto: (id: string) => void;
  onSetCardPhoto: (url: string) => void;
  onDownloadBoard: () => void;
}) {
  const title = v.nickname || [v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle";
  const story = lang === "af" ? v.story_af || v.story : v.story;
  const hero = v.photos.find((p) => p.url) ?? v.photos[0];

  return (
    <li className="overflow-hidden rounded-2xl border-2 border-ink bg-paper shadow-[4px_4px_0_0_var(--color-ink)]">
      <div className="grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="relative min-h-[200px] bg-ink/10">
          {hero?.url ? (
            <img
              src={hero.url}
              alt={title}
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
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

          <div className="mt-4 flex flex-wrap gap-2">
          {hero?.url && (
            <button
              type="button"
              disabled={busy || cardPhotoUrl === hero.url}
              onClick={() => onSetCardPhoto(hero.url)}
              className="inline-flex items-center gap-2 self-start rounded-md border-2 border-ink bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-paper disabled:opacity-50"
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
            <button
              type="button"
              disabled={busy || !hero?.url}
              title={
                hero?.url
                  ? undefined
                  : lang === "af"
                    ? "Laai eers ’n foto op"
                    : "Upload a photo first"
              }
              onClick={onDownloadBoard}
              className="inline-flex items-center gap-2 self-start rounded-md border-2 border-ink bg-paper px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink hover:bg-ink/5 disabled:opacity-50"
            >
              <FileDown className="h-3.5 w-3.5" />
              {lang === "af" ? "Vertoonbord PDF" : "Display board PDF"}
            </button>
          </div>
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
                <img
                  src={p.url}
                  alt=""
                  className="h-20 w-20 rounded border-2 border-ink object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.opacity = "0.3";
                  }}
                />
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
            </div>
          ))}
          {v.photos.length < 8 && (
            <button
              type="button"
              disabled={busy}
              onClick={onUpload}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-ink/40 text-ink/50 hover:border-ink hover:text-ink disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span className="text-[9px] font-bold uppercase">
                {lang === "af" ? "Laai" : "Upload"}
              </span>
            </button>
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

        <details className="rounded-md border-2 border-ink/30 p-3">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-ink/70">
            {lang === "af"
              ? "Spesifikasieblad (vir vertoonbord)"
              : "Spec sheet (for display board)"}
          </summary>
          <p className="mt-2 text-[11px] text-ink/50">
            {lang === "af"
              ? "Alles opsioneel — leë velde word van die bord gelaat."
              : "All optional — blank fields are left off the board."}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {SPEC_FIELDS.map((f) => (
              <Field key={String(f.key)} label={lang === "af" ? f.af : f.en}>
                <input
                  value={(form[f.key] as string | null) ?? ""}
                  onChange={(e) =>
                    setForm((s2) => ({ ...s2, [f.key]: e.target.value }))
                  }
                  className={inp}
                />
              </Field>
            ))}
          </div>
        </details>

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
