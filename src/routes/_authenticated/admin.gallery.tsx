import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import {
  listAllGalleryItems,
  createGalleryItem,
  togglePublishGalleryItem,
  deleteGalleryItem,
  type GalleryItem,
} from "@/lib/gallery.functions";
import { Trash2, Plus, X } from "lucide-react";

const galleryAdminQuery = queryOptions({
  queryKey: ["gallery", "admin"],
  queryFn: () => listAllGalleryItems(),
});

export const Route = createFileRoute("/_authenticated/admin/gallery")({
  head: () => ({ meta: [{ title: "Manage Gallery — Just Wheels" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(galleryAdminQuery),
  component: AdminGallery,
  errorComponent: ({ error }) => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-ink/70">Access denied: {error.message}</p>
      </div>
    </SiteLayout>
  ),
});

function AdminGallery() {
  const { data: items } = useSuspenseQuery(galleryAdminQuery);
  const qc = useQueryClient();
  const create = useServerFn(createGalleryItem);
  const toggle = useServerFn(togglePublishGalleryItem);
  const del = useServerFn(deleteGalleryItem);
  const [adding, setAdding] = useState<null | { title: string; caption: string; image_url: string }>(null);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["gallery"] });
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl tracking-wide text-ink">Manage gallery</h1>
            <p className="mt-1 text-sm text-ink/60">
              Paste a public image URL (upload to the gallery bucket externally if needed).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAdding({ title: "", caption: "", image_url: "" })}
            className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper"
          >
            <Plus className="h-4 w-4" /> New photo
          </button>
        </div>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it: GalleryItem) => (
            <li key={it.id} className="overflow-hidden rounded-lg border-2 border-ink bg-card shadow-[3px_3px_0_0_var(--color-ink)]">
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

        {adding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4" onClick={() => setAdding(null)}>
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={async (e) => {
                e.preventDefault();
                await create({
                  data: {
                    title: adding.title || null,
                    caption: adding.caption || null,
                    image_url: adding.image_url,
                    is_published: true,
                  },
                });
                setAdding(null);
                await refresh();
              }}
              className="w-full max-w-lg space-y-3 rounded-2xl border-2 border-ink bg-paper p-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl text-ink">New photo</h2>
                <button type="button" onClick={() => setAdding(null)} className="rounded-full border-2 border-ink p-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Title</span>
                <input value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2" />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Caption</span>
                <input value={adding.caption} onChange={(e) => setAdding({ ...adding, caption: e.target.value })} className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2" />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-ink/70">Image URL</span>
                <input required value={adding.image_url} onChange={(e) => setAdding({ ...adding, image_url: e.target.value })} className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2" placeholder="https://..." />
              </label>
              <button type="submit" className="w-full rounded-md border-2 border-ink bg-primary px-4 py-3 font-bold uppercase tracking-wider text-paper">
                Save
              </button>
            </form>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
