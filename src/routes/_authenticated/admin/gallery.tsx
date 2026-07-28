import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listAllGalleryItems,
  createGalleryItem,
  togglePublishGalleryItem,
  deleteGalleryItem,
  type GalleryItem,
} from "@/lib/gallery.functions";
import { Trash2, Plus, X, Upload, Loader2, Link2 } from "lucide-react";

const galleryAdminQuery = queryOptions({
  queryKey: ["gallery", "admin"],
  queryFn: () => listAllGalleryItems(),
});

export const Route = createFileRoute("/_authenticated/admin/gallery")({
  head: () => ({
    meta: [{ title: "Manage Gallery — Just Wheels" }, { name: "robots", content: "noindex" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(galleryAdminQuery),
  component: AdminGallery,
  errorComponent: ({ error }) => (
    <div className="py-20 text-center">
      <p className="text-ink/70">Access denied: {error.message}</p>
    </div>
  ),
});

const MAX_MB = 8;
const MAX_FILES = 24;

function pickImageFiles(): Promise<File[]> {
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

async function resolveUrl(path: string): Promise<string> {
  const { data: pub } = supabase.storage.from("gallery").getPublicUrl(path);
  if (pub?.publicUrl) {
    const { data: signed } = await supabase.storage
      .from("gallery")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    return signed?.signedUrl ?? pub.publicUrl;
  }
  const { data: signed } = await supabase.storage
    .from("gallery")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  return signed?.signedUrl ?? "";
}

function AdminGallery() {
  const { data: items } = useSuspenseQuery(galleryAdminQuery);
  const qc = useQueryClient();
  const create = useServerFn(createGalleryItem);
  const toggle = useServerFn(togglePublishGalleryItem);
  const del = useServerFn(deleteGalleryItem);

  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urlForm, setUrlForm] = useState<null | { title: string; caption: string; image_url: string }>(
    null,
  );

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["gallery"] });
  }

  async function uploadMany() {
    setError(null);
    setStatus("Choose photos…");
    setUploading(true);
    try {
      const files = await pickImageFiles();
      if (!files.length) {
        setStatus(null);
        setUploading(false);
        return;
      }

      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error("Not signed in");

      const batch = files.slice(0, MAX_FILES);
      let ok = 0;
      const failures: string[] = [];

      for (let i = 0; i < batch.length; i++) {
        const file = batch[i];
        setStatus(`Uploading ${i + 1}/${batch.length}: ${file.name}`);

        if (!file.type.startsWith("image/")) {
          failures.push(`${file.name}: not an image`);
          continue;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
          failures.push(`${file.name}: max ${MAX_MB}MB`);
          continue;
        }

        const ext =
          (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `photos/${userId}/${crypto.randomUUID()}.${ext}`;

        const { error: upErr } = await supabase.storage.from("gallery").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "image/jpeg",
        });
        if (upErr) {
          failures.push(`${file.name}: ${upErr.message}`);
          continue;
        }

        const url = await resolveUrl(path);
        if (!url) {
          failures.push(`${file.name}: could not resolve URL`);
          continue;
        }

        try {
          await create({
            data: {
              title: file.name.replace(/\.[^.]+$/, "").slice(0, 120) || null,
              caption: null,
              image_url: url,
              is_published: true,
            },
          });
          ok += 1;
        } catch (e) {
          failures.push(
            `${file.name}: ${e instanceof Error ? e.message : "DB insert failed"}`,
          );
        }
      }

      await refresh();
      if (failures.length && ok === 0) throw new Error(failures.join(" · "));
      if (failures.length) setError(`Some failed: ${failures.join(" · ")}`);
      setStatus(ok > 0 ? `${ok} photo(s) uploaded` : null);
      if (ok > 0) setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setStatus(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-wide text-ink sm:text-4xl">Manage gallery</h1>
          <p className="mt-1 text-sm text-ink/60">
            Upload several photos at once for the public Gallery page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => void uploadMany()}
            className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload photos
          </button>
          <button
            type="button"
            onClick={() => setUrlForm({ title: "", caption: "", image_url: "" })}
            className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-paper px-4 py-2 text-sm font-bold uppercase tracking-wider text-ink"
          >
            <Link2 className="h-4 w-4" /> Paste URL
          </button>
        </div>
      </div>

      {status && (
        <p className="mt-3 flex items-center gap-2 rounded border-2 border-ink/20 bg-paper px-3 py-2 text-sm text-ink/70">
          {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
          {status}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded border-2 border-primary bg-primary/10 px-3 py-2 text-sm text-primary">
          {error}
        </p>
      )}

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it: GalleryItem) => (
          <li
            key={it.id}
            className="overflow-hidden rounded-lg border-2 border-ink bg-card shadow-[3px_3px_0_0_var(--color-ink)]"
          >
            <img src={it.image_url} alt={it.title ?? ""} className="h-48 w-full object-cover" />
            <div className="p-3">
              <div className="text-xs uppercase tracking-wider text-primary">
                {it.is_published ? "Published" : "Hidden"}
              </div>
              <p className="font-display text-base text-ink">{it.title ?? "(untitled)"}</p>
              <p className="line-clamp-2 text-xs text-ink/70">{it.caption ?? ""}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await toggle({ data: { id: it.id, is_published: !it.is_published } });
                    await refresh();
                  }}
                  className="rounded border-2 border-ink bg-paper px-2 py-1 text-xs font-bold uppercase"
                >
                  {it.is_published ? "Hide" : "Publish"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm("Delete this photo?")) return;
                    await del({ data: { id: it.id } });
                    await refresh();
                  }}
                  className="rounded border-2 border-primary bg-primary p-2 text-paper"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {items.length === 0 && !uploading && (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-ink/30 bg-ink/5 px-6 py-12 text-center">
          <p className="font-display text-xl text-ink/50">No gallery photos yet</p>
          <button
            type="button"
            onClick={() => void uploadMany()}
            className="mt-4 inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase text-paper"
          >
            <Plus className="h-4 w-4" /> Upload photos
          </button>
        </div>
      )}

      {urlForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
          onClick={() => setUrlForm(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              await create({
                data: {
                  title: urlForm.title || null,
                  caption: urlForm.caption || null,
                  image_url: urlForm.image_url,
                  is_published: true,
                },
              });
              setUrlForm(null);
              await refresh();
            }}
            className="w-full max-w-lg space-y-3 rounded-2xl border-2 border-ink bg-paper p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl text-ink">Add by URL</h2>
              <button
                type="button"
                onClick={() => setUrlForm(null)}
                className="rounded-full border-2 border-ink p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Title</span>
              <input
                value={urlForm.title}
                onChange={(e) => setUrlForm({ ...urlForm, title: e.target.value })}
                className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Caption</span>
              <input
                value={urlForm.caption}
                onChange={(e) => setUrlForm({ ...urlForm, caption: e.target.value })}
                className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Image URL</span>
              <input
                required
                value={urlForm.image_url}
                onChange={(e) => setUrlForm({ ...urlForm, image_url: e.target.value })}
                className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2"
                placeholder="https://…"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-md border-2 border-ink bg-primary px-4 py-3 font-bold uppercase tracking-wider text-paper"
            >
              Save
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
