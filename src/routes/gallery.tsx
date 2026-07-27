import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { listGalleryItems } from "@/lib/gallery.functions";
import { Camera } from "lucide-react";

const galleryQuery = queryOptions({
  queryKey: ["gallery"],
  queryFn: () => listGalleryItems(),
  staleTime: 60_000,
});

const SITE_ORIGIN = "https://justwheels.co.za";
const OG_LOGO = `${SITE_ORIGIN}/__l5e/assets-v1/1ea9f7fc-2fa5-428f-a1df-f1a298d9caaa/justwheels-logo.jpeg`;

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

  return (
    <SiteLayout>
      <section className="border-b-2 border-ink bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="mb-3 inline-block rounded-full border-2 border-primary bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-primary">
            {t("nav.gallery")}
          </div>
          <h1 className="font-display text-5xl tracking-wide sm:text-6xl">
            {lang === "af" ? "Wiele. Vonke. Stories." : "Wheels. Sparks. Stories."}
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        {items.length === 0 ? (
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
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((it) => (
              <li
                key={it.id}
                className="group relative overflow-hidden rounded-lg border-2 border-ink bg-card shadow-[3px_3px_0_0_var(--color-ink)]"
              >
                <img
                  src={it.image_url}
                  alt={it.title ?? it.caption ?? "Just Wheels Hessequa"}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                />
                {it.caption ? (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent p-2 text-xs font-semibold text-paper opacity-0 transition-opacity group-hover:opacity-100">
                    {it.caption}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </SiteLayout>
  );
}
