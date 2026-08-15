import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  listEventPhotos,
  addEventPhoto,
  deleteEventPhoto,
  notifyEventPhotosAdded,
  type EventPhoto,
} from "@/lib/event-photos.functions";
import { ImageLightbox } from "@/components/ImageLightbox";
import { Camera, Loader2, Upload, X } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";

const MAX_MB = 6;

function pickFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/gif,image/*";
    input.multiple = true;
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", () => {
      const files = input.files ? Array.from(input.files) : [];
      document.body.removeChild(input);
      resolve(files);
    });
    input.addEventListener("cancel", () => {
      document.body.removeChild(input);
      resolve([]);
    });
    input.click();
  });
}

export function EventPhotosGallery({
  eventId,
  lang = "en",
}: {
  eventId: string;
  lang?: "en" | "af";
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listEventPhotos);
  const addFn = useServerFn(addEventPhoto);
  const delFn = useServerFn(deleteEventPhoto);
  const notifyFn = useServerFn(notifyEventPhotosAdded);

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setUserId(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSignedIn(Boolean(s));
      setUserId(s?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["event-photos", eventId],
    queryFn: () => listFn({ data: { eventId } }),
    staleTime: 30_000,
  });

  const lightboxItems = photos
    .filter((p) => p.url)
    .map((p) => ({
      url: p.url,
      caption:
        p.caption ||
        p.display_name ||
        (p.member_number != null ? `#${p.member_number}` : null),
    }));

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["event-photos", eventId] });
  }

  async function startUpload() {
    setBusy(true);
    setError(null);
    setStatus(lang === "af" ? "Kies foto(s)…" : "Choose photo(s)…");
    try {
      const files = await pickFiles();
      if (!files.length) {
        setStatus(null);
        setBusy(false);
        return;
      }

      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) throw new Error(lang === "af" ? "Teken eers in" : "Sign in first");

      let ok = 0;
      let usedFallback = false;
      const fails: string[] = [];

      for (let i = 0; i < Math.min(files.length, 12); i++) {
        const file = files[i];
        setStatus(
          lang === "af"
            ? `Laai op ${i + 1}/${files.length}: ${file.name}`
            : `Uploading ${i + 1}/${files.length}: ${file.name}`,
        );

        if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif)$/i.test(file.name)) {
          fails.push(`${file.name}: not an image`);
          continue;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
          fails.push(`${file.name}: max ${MAX_MB}MB`);
          continue;
        }
        const ext =
          (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${uid}/${eventId}/${crypto.randomUUID()}.${ext}`;

        const { error: upErr } = await supabase.storage.from("events").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "image/jpeg",
        });
        if (upErr) {
          fails.push(
            `${file.name}: ${
              upErr.message.includes("Bucket not found")
                ? "events bucket missing — run SQL"
                : upErr.message.includes("policy") || upErr.message.includes("row-level")
                  ? "storage policy blocked — run events bucket SQL"
                  : upErr.message
            }`,
          );
          continue;
        }

        // Prefer server fn; fall back to direct insert
        try {
          await addFn({ data: { eventId, storage_path: path, caption: null } });
          ok += 1;
        } catch (e) {
          const { error: dbErr } = await supabase.from("event_photos").insert({
            event_id: eventId,
            user_id: uid,
            storage_path: path,
            caption: null,
          });
          if (dbErr) {
            fails.push(`${file.name}: ${dbErr.message}`);
            await supabase.storage.from("events").remove([path]);
          } else {
            ok += 1;
            usedFallback = true;
          }
        }
      }

      await refresh();
      setStatus(null);
      if (fails.length && ok === 0) throw new Error(fails.join(" · "));
      if (fails.length) setError(fails.join(" · "));
      if (ok > 0) {
        if (usedFallback) {
          try {
            await notifyFn({ data: { eventId } });
          } catch {
            /* notify is best-effort */
          }
        }
        setStatus(lang === "af" ? `${ok} foto(s) gelaai` : `${ok} photo(s) uploaded`);
        setTimeout(() => setStatus(null), 3000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!(await confirm({
      title: lang === "af" ? "Verwyder hierdie foto?" : "Delete this photo?",
      confirmLabel: lang === "af" ? "Verwyder" : "Delete",
      cancelLabel: lang === "af" ? "Kanselleer" : "Cancel",
    })))
      return;
    setBusy(true);
    try {
      await delFn({ data: { id } });
      await refresh();
    } catch (e) {
      const { error: dbErr } = await supabase.from("event_photos").delete().eq("id", id);
      if (dbErr) setError(e instanceof Error ? e.message : "Delete failed");
      else await refresh();
    } finally {
      setBusy(false);
    }
  }

  function openPhoto(p: EventPhoto) {
    const idx = lightboxItems.findIndex((it) => it.url === p.url);
    if (idx >= 0) setLightboxIndex(idx);
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-ink">
            {lang === "af" ? "Byeenkoms-fotos" : "Event photos"}
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            {lang === "af"
              ? "Lede kan fotos byvoeg terwyl die byeenkoms aan die gang is én daarna."
              : "Members can add photos while the event is on — and after it ends."}
          </p>
        </div>
        {signedIn ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void startUpload()}
            className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-paper disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {lang === "af" ? "Laai fotos" : "Add photos"}
          </button>
        ) : signedIn === false ? (
          <Link
            to="/auth"
            search={{ redirect: `/events/${eventId}` }}
            className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-paper px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink"
          >
            <Camera className="h-4 w-4" />
            {lang === "af" ? "Teken in om fotos by te voeg" : "Sign in to add photos"}
          </Link>
        ) : null}
      </div>

      {error && (
        <p className="mt-3 rounded border-2 border-primary bg-primary/10 px-3 py-2 text-sm text-primary">
          {error}
        </p>
      )}
      {status && (
        <p className="mt-3 flex items-center gap-2 rounded border-2 border-ink/20 bg-paper px-3 py-2 text-sm text-ink/70">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {status}
        </p>
      )}

      {isLoading ? (
        <p className="mt-6 text-ink/50">{lang === "af" ? "Laai…" : "Loading…"}</p>
      ) : photos.length === 0 ? (
        <div className="mt-6 rounded-xl border-2 border-dashed border-ink/30 bg-ink/5 px-6 py-12 text-center">
          <Camera className="mx-auto h-8 w-8 text-ink/30" />
          <p className="mt-2 font-display text-xl text-ink/50">
            {lang === "af" ? "Nog geen fotos nie" : "No photos yet"}
          </p>
          <p className="mt-1 text-sm text-ink/45">
            {lang === "af"
              ? "Wees die eerste — laai 'n foto van die dag op."
              : "Be the first — upload a shot from the day."}
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p) => (
            <li
              key={p.id}
              className="group relative overflow-hidden rounded-lg border-2 border-ink bg-ink/5"
            >
              <button type="button" className="block w-full" onClick={() => openPhoto(p)}>
                {p.url ? (
                  <img
                    src={p.url}
                    alt=""
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center text-xs text-ink/40">
                    …
                  </div>
                )}
              </button>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent px-2 pb-1.5 pt-6 text-[10px] text-paper opacity-0 transition-opacity group-hover:opacity-100">
                {p.display_name ?? (p.member_number != null ? `#${p.member_number}` : "Member")}
              </div>
              {userId && p.user_id === userId && (
                <button
                  type="button"
                  onClick={() => void onDelete(p.id)}
                  className="absolute right-1.5 top-1.5 rounded-full border border-ink bg-primary p-0.5 text-paper opacity-0 group-hover:opacity-100"
                  aria-label="Delete"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {lightboxIndex != null && lightboxItems.length > 0 && (
        <ImageLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndex={setLightboxIndex}
        />
      )}
    </section>
  );
}
