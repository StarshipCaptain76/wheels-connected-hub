import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { getListing } from "@/lib/listings.functions";
import { ArrowLeft, MapPin, Phone, Mail } from "lucide-react";

const listingQuery = (id: string) =>
  queryOptions({
    queryKey: ["listing", id],
    queryFn: () => getListing({ data: { id } }),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/classifieds/$id")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(listingQuery(params.id));
    if (!data) throw notFound();
    return data;
  },
  head: ({ params, loaderData }) => {
    const title = loaderData?.title ?? "Listing";
    const url = `https://wheels-connected-hub.lovable.app/classifieds/${params.id}`;
    const image = loaderData?.photos[0]?.url;
    const jsonLd = loaderData
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: loaderData.title,
          description: loaderData.description ?? undefined,
          image: image ? [image] : undefined,
          offers: {
            "@type": "Offer",
            priceCurrency: "ZAR",
            price: loaderData.price_zar ?? undefined,
            availability: "https://schema.org/InStock",
            url,
          },
        }
      : null;
    return {
      meta: [
        { title: `${title} — Just Wheels Classifieds` },
        {
          name: "description",
          content:
            loaderData?.description?.slice(0, 150) ??
            "For sale by a Just Wheels Hessequa member.",
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: loaderData?.description?.slice(0, 150) ?? "",
        },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: jsonLd
        ? [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }]
        : [],
    };
  },

  component: ListingDetail,
  notFoundComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="font-display text-3xl text-ink">Not found.</p>
        <Link to="/classifieds" className="mt-4 inline-block text-primary underline">
          Back to classifieds
        </Link>
      </div>
    </SiteLayout>
  ),
});

function ListingDetail() {
  const { lang } = useI18n();
  const params = Route.useParams();
  const { data: listing } = useSuspenseQuery(listingQuery(params.id));
  const [revealEmail, setRevealEmail] = useState(false);
  if (!listing) return null;

  const title = lang === "af" && listing.title_af ? listing.title_af : listing.title;
  const description =
    lang === "af" && listing.description_af ? listing.description_af : listing.description;

  const [emailUser, emailDomain] = listing.contact_email.split("@");

  return (
    <SiteLayout>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Link
          to="/classifieds"
          className="inline-flex items-center gap-1 text-sm text-ink/70 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> {lang === "af" ? "Terug" : "Back"}
        </Link>

        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <div className="space-y-3">
            {listing.photos.length > 0 ? (
              listing.photos.map((p) => (
                <img
                  key={p.id}
                  src={p.url}
                  alt=""
                  className="w-full rounded-lg border-2 border-ink object-cover"
                />
              ))
            ) : (
              <div
                className="h-64 w-full rounded-lg border-2 border-ink"
                style={{
                  background:
                    "repeating-linear-gradient(45deg, var(--color-primary) 0 12px, var(--color-ink) 12px 24px)",
                }}
                aria-hidden
              />
            )}
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-primary">
              {listing.category} · {listing.condition}
            </div>
            <h1 className="mt-2 font-display text-4xl tracking-wide text-ink">{title}</h1>
            {listing.price_zar != null ? (
              <p className="mt-3 font-display text-3xl text-primary">
                R {listing.price_zar.toLocaleString("en-ZA")}
              </p>
            ) : (
              <p className="mt-3 italic text-ink/70">
                {lang === "af" ? "Prys op aanvraag" : "Price on request"}
              </p>
            )}
            {listing.location ? (
              <p className="mt-2 inline-flex items-center gap-1 text-sm text-ink/70">
                <MapPin className="h-4 w-4" /> {listing.location}
              </p>
            ) : null}

            <div className="prose mt-6 max-w-none whitespace-pre-wrap text-ink/80">
              {description}
            </div>

            <div className="mt-8 rounded-lg border-2 border-ink bg-card p-5 shadow-[4px_4px_0_0_var(--color-ink)]">
              <div className="font-display text-lg tracking-wide text-ink">
                {lang === "af" ? "Kontak verkoper" : "Contact seller"}
              </div>
              <p className="mt-1 text-xs text-ink/60">
                {lang === "af"
                  ? "Betaling word direk met die verkoper hanteer. Die klub is nie betrokke nie."
                  : "Payment is arranged directly with the seller. The club is not involved."}
              </p>
              <p className="mt-3 font-semibold">{listing.contact_name}</p>
              {listing.contact_phone ? (
                <p className="mt-1 inline-flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4" />
                  <a href={`tel:${listing.contact_phone}`} className="hover:underline">
                    {listing.contact_phone}
                  </a>
                </p>
              ) : null}
              <p className="mt-1 inline-flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4" />
                {revealEmail ? (
                  <a
                    href={`mailto:${emailUser}@${emailDomain}`}
                    className="hover:underline"
                  >
                    {emailUser}@{emailDomain}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRevealEmail(true)}
                    className="text-primary underline"
                  >
                    {lang === "af" ? "Wys e-pos" : "Show email"}
                  </button>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
