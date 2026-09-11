import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { ImageLightbox, type LightboxItem } from "@/components/ImageLightbox";
import { useI18n } from "@/i18n/I18nProvider";
import { getMemberFeatureBySlug } from "@/lib/member-features.functions";
import { ArrowLeft, Sparkles } from "lucide-react";

const SITE_ORIGIN = "https://www.justwheels.co.za";

const featureQuery = (slug: string) =>
  queryOptions({
    queryKey: ["member-feature", slug],
    queryFn: () => getMemberFeatureBySlug({ data: { slug } }),
    staleTime: 60_000,
  });

export const Route = createFileRoute("/features/$slug")({
  loader: async ({ context, params }) => {
    try {
      const row = await getMemberFeatureBySlug({ data: { slug: params.slug } });
      if (row) context.queryClient.setQueryData(["member-feature", params.slug], row);
      return row;
    } catch (e) {
      console.error("[features/$slug] loader", e);
      return null;
    }
  },
  head: ({ params, loaderData }) => {
    const title = loaderData?.headline_en || "Member story";
    const desc = loaderData?.deck_en || loaderData?.body_en?.slice(0, 150) || "";
    const url = `${SITE_ORIGIN}/features/${params.slug}`;
    return {
      meta: [
        { title: `${title} | Just Wheels Hessequa` },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        ...(loaderData?.cover_url
          ? [
              { property: "og:image", content: loaderData.cover_url },
              { name: "twitter:image", content: loaderData.cover_url },
            ]
          : []),
        { name: "twitter:card", content: "summary_large_image" },
        ...(!loaderData?.published ? [{ name: "robots", content: "noindex" }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: FeatureStoryPage,
  notFoundComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl">Story not found</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">
          Back home
        </Link>
      </div>
    </SiteLayout>
  ),
});

function FeatureStoryPage() {
  const { slug } = Route.useParams();
  const ssrData = Route.useLoaderData();
  const { lang } = useI18n();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  // SSR has no bearer token. Admins previewing a draft refetch on the client.
  const q = useQuery({
    ...featureQuery(slug),
    enabled: hydrated && !ssrData,
    initialData: ssrData ?? undefined,
  });
  const data = q.data ?? ssrData;
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (!data) {
    if (!hydrated || q.isFetching || q.isLoading) {
      return (
        <SiteLayout>
          <div className="mx-auto max-w-2xl px-4 py-20 text-center text-ink/60">Loading…</div>
        </SiteLayout>
      );
    }
    return (
      <SiteLayout>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="font-display text-3xl">Story not found</h1>
          <Link to="/" className="mt-4 inline-block text-primary underline">
            Back home
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const headline = lang === "af" && data.headline_af ? data.headline_af : data.headline_en;
  const deck = lang === "af" && data.deck_af ? data.deck_af : data.deck_en;
  const body = lang === "af" && data.body_af ? data.body_af : data.body_en;
  const date = data.published_at || data.created_at;
  const dateLabel = date
    ? new Date(date).toLocaleDateString(lang === "af" ? "af-ZA" : "en-ZA", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const gallery: LightboxItem[] = [
    ...(data.cover_url ? [{ url: data.cover_url, caption: headline }] : []),
    ...data.photos.map((p) => ({
      url: p.url,
      caption: (lang === "af" && p.caption_af ? p.caption_af : p.caption_en) || headline,
    })),
  ];

  return (
    <SiteLayout>
      <article className="mx-auto max-w-3xl px-4 py-10">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-2 text-sm text-ink/60 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> {lang === "af" ? "Terug huis toe" : "Back home"}
        </Link>

        {!data.published && (
          <p className="mb-4 rounded-md border-2 border-primary bg-primary/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary">
            {lang === "af" ? "Konsep — slegs admins sien dit" : "Draft — admins only"}
          </p>
        )}

        {data.cover_url && (
          <button
            type="button"
            onClick={() => setLightbox(0)}
            className="group relative mb-6 block w-full overflow-hidden rounded-xl border-2 border-ink shadow-[4px_4px_0_0_var(--color-ink)]"
          >
            <img src={data.cover_url} alt="" className="max-h-[28rem] w-full object-cover" />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border-2 border-ink bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-paper">
              <Sparkles className="h-3 w-3" />
              {lang === "af" ? "Nuwe lid" : "New member"}
            </span>
          </button>
        )}

        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          {lang === "af" ? "Nuwe lid" : "New member"}
          {dateLabel ? ` · ${dateLabel}` : ""}
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-wide text-ink sm:text-5xl">{headline}</h1>

        <Link
          to="/members/$number"
          params={{ number: String(data.member_number) }}
          className="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-paper px-3 py-1 text-sm text-ink hover:bg-ink hover:text-paper"
        >
          <span className="font-bold">{data.member_display_name || (lang === "af" ? "Lid" : "Member")}</span>
          <span className="text-ink/60">#{String(data.member_number).padStart(4, "0")}</span>
          {data.member_town ? <span className="text-ink/60">· {data.member_town}</span> : null}
        </Link>

        {data.member_favourite_ride && (
          <p className="mt-2 text-sm text-ink/70">
            <span className="font-bold">{lang === "af" ? "Gunsteling rit: " : "Favourite ride: "}</span>
            {data.member_favourite_ride}
          </p>
        )}

        {deck && <p className="mt-5 text-lg leading-relaxed text-ink/80">{deck}</p>}

        {body && (
          <div className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-ink/85">{body}</div>
        )}

        {data.photos.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-2xl text-ink">
              {lang === "af" ? "Foto’s" : "Photos"}
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.photos.map((p, i) => {
                const caption =
                  (lang === "af" && p.caption_af ? p.caption_af : p.caption_en) || "";
                const galleryIndex = (data.cover_url ? 1 : 0) + i;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setLightbox(galleryIndex)}
                      className="block w-full overflow-hidden rounded-lg border-2 border-ink bg-paper"
                    >
                      <img src={p.url} alt={caption} className="aspect-square w-full object-cover" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </article>

      {lightbox != null && gallery[lightbox] && (
        <ImageLightbox
          items={gallery}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
        />
      )}
    </SiteLayout>
  );
}
