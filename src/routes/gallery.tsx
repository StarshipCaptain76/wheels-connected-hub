import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { ImageLightbox } from "@/components/ImageLightbox";
import { useI18n } from "@/i18n/I18nProvider";
import { LOGO_URL } from "@/lib/brand";
import { listGalleryItems, type GalleryItem } from "@/lib/gallery.functions";
import { Camera } from "lucide-react";

const galleryQuery = queryOptions({
  queryKey: ["gallery"],
  queryFn: () => listGalleryItems(),
  staleTime: 60_000,
});

const SITE_ORIGIN = "https://justwheels.co.za";
const OG_LOGO = `${SITE_ORIGIN}${LOGO_URL}`;

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery | Just Wheels Hessequa" },
      {
        name: "description",
        content:
          "Photos from Just Wheels Hessequa runs, shows and workshop days across the Hessequa region and Southern Cape.",
      },
      { property: "og:title", content: "Gallery | Just Wheels Hessequa" },
      { property: "og:description", content: "Photos from runs, shows and workshop days." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_ORIGIN}/gallery` },
      { property: "og:image", content: OG_LOGO },
      { name: "twitter:image", content: OG_LOGO },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/gallery` }],
  }),

  loader: ({ context }) => context.queryClient.ensureQueryData(galleryQuery),
  component: GalleryPage,
  errorComponent: ({ error }) => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-ink/70">Could not load gallery: {error.message}</p>
      </div>
    </SiteLayout>
  ),
  pendingComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-ink/60">Loading…</div>
    </SiteLayout>
  ),
});

function GalleryPage() {
  const { t, lang } = useI18n();
  const { data: items } = useSuspenseQuery(galleryQuery);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const categories = Array.from(
    new Set(items.map((it) => it.category).filter(Boolean) as string[]),
  ).sort();
  const visible = activeCat ? items.filter((it) => it.category === activeCat) : items;

  const lightboxItems = visible
    .filter((it) => it.image_url)
    .map((it) => ({
      url: it.image_url,
      caption: it.title || it.caption || null,
    }));

  function openItem(it: GalleryItem) {
    const idx = lightboxItems.findIndex((x) => x.url === it.image_url);
    if (idx >= 0) setLightboxIndex(idx);
  }

  return (
    <SiteLayout>
      <section className="border-b-2 border-ink bg-ink text-paper">
        <div className="mx-auto max-w-7xl px-4 py-14">
          <div className="mb-3 inline-block rounded-full border-2 border-primary bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-primary">
            {t("nav.gallery")}
          </div>
          <h1 className="font-display text-5xl tracking-wide sm:text-6xl">
            {lang === "af" ? "Wiele. Vonke. Stories." : "Wheels. Sparks. Stories."}
          </h1>
          {items.length > 0 && (
            <p className="mt-3 text-sm text-paper/60">
              {visible.length} {lang === "af" ? "fotos" : "photos"} ·{" "}
              {lang === "af" ? "rol af om meer te sien" : "scroll for more"}
            </p>
          )}
        </div>
      </section>

      {categories.length > 0 && (
        <div className="border-b-2 border-ink bg-card">
          <div className="mx-auto flex max-w-7xl snap-x gap-2 overflow-x-auto px-3 py-3 sm:px-4">
            <button
              type="button"
              onClick={() => setActiveCat(null)}
              className={`shrink-0 snap-start rounded-full border-2 border-ink px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                activeCat === null ? "bg-primary text-paper" : "bg-paper text-ink"
              }`}
            >
              {lang === "af" ? "Alles" : "All"}
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCat(c)}
                className={`shrink-0 snap-start rounded-full border-2 border-ink px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                  activeCat === c ? "bg-primary text-paper" : "bg-paper text-ink"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="mx-auto max-w-7xl px-3 py-10 sm:px-4 sm:py-14">
        {visible.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-ink/30 bg-card p-12 text-center">
            <Camera className="mx-auto h-10 w-10 text-ink/40" />
            <p className="mt-4 font-display text-2xl text-ink">
              {lang === "af" ? "Nog geen foto's nie." : "No photos yet."}
            </p>
            <p className="mt-2 text-ink/60">
              {lang === "af"
                ? "Foto's van ons volgende rit sal hier verskyn."
                : "Photos from our next run will land here."}
            </p>
          </div>
        ) : (
          <ul className="columns-2 gap-3 sm:columns-3 sm:gap-4 md:columns-4 lg:columns-5 xl:columns-6">
            {visible.map((it) => (
              <li key={it.id} className="mb-3 break-inside-avoid sm:mb-4">
                <button
                  type="button"
                  onClick={() => openItem(it)}
                  className="group block w-full overflow-hidden rounded-lg border-2 border-ink bg-card text-left shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
                >
                  <img
                    src={it.image_url}
                    alt={it.title ?? it.caption ?? "Just Wheels Hessequa"}
                    loading="lazy"
                    className="w-full object-cover transition-transform group-hover:scale-[1.02]"
                  />
                  {(it.title || it.caption) && (
                    <div className="border-t border-ink/10 px-2 py-1.5">
                      {it.title && (
                        <p className="truncate text-xs font-bold text-ink">{it.title}</p>
                      )}
                      {it.caption && (
                        <p className="line-clamp-2 text-[11px] text-ink/60">{it.caption}</p>
                      )}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {lightboxIndex != null && lightboxItems.length > 0 && (
        <ImageLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndex={setLightboxIndex}
        />
      )}
    </SiteLayout>
  );
}
