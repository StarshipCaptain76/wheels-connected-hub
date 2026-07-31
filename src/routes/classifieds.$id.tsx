import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { LOGO_URL } from "@/lib/brand";
import { getPublicListing, getListing } from "@/lib/listings.functions";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, Phone, Mail, MessageCircle } from "lucide-react";

const SITE_ORIGIN = "https://justwheels.co.za";
const OG_LOGO = `${SITE_ORIGIN}${LOGO_URL}`;

const publicListingQuery = (id: string) =>
  queryOptions({
    queryKey: ["listing", id, "public"],
    queryFn: () => getPublicListing({ data: { id } }),
    staleTime: 30_000,
  });

function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

function waLink(phone: string): string {
  let d = phoneDigits(phone);
  if (d.startsWith("0") && d.length >= 10) d = "27" + d.slice(1);
  return `https://wa.me/${d}`;
}

export const Route = createFileRoute("/classifieds/$id")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(publicListingQuery(params.id));
    if (!data) throw notFound();
    return data;
  },
  head: ({ params, loaderData }) => {
    const title = loaderData?.title ?? "Listing";
    const url = `${SITE_ORIGIN}/classifieds/${params.id}`;
    const image = loaderData?.photos[0]?.url ?? OG_LOGO;
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
        { title: `${title} | Just Wheels Classifieds` },
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
        { property: "og:image", content: image },
        { name: "twitter:image", content: image },
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
  const { t, lang } = useI18n();
  const params = Route.useParams();
  const { data: listing } = useSuspenseQuery(publicListingQuery(params.id));
  const [revealEmail, setRevealEmail] = useState(false);
  const [session, setSession] = useState<unknown>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  const getListingFn = useServerFn(getListing);
  const { data: fullListing } = useQuery({
    queryKey: ["listing", params.id, "full"],
    queryFn: () => getListingFn({ data: { id: params.id } }),
    enabled: !!session && !!listing,
    staleTime: 60_000,
  });

  const display = fullListing ?? listing;
  if (!display) return null;

  const title = lang === "af" && display.title_af ? display.title_af : display.title;
  const description =
    lang === "af" && display.description_af ? display.description_af : display.description;

  const contact = display.contact;
  const [emailUser, emailDomain] = contact?.contact_email
    ? contact.contact_email.split("@")
    : ["", ""];
  const phone = contact?.contact_phone?.trim() || "";

  return (
    <SiteLayout>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Link
          to="/classifieds"
          className="inline-flex min-h-11 items-center gap-1 text-base text-ink/70 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> {lang === "af" ? "Terug" : "Back"}
        </Link>

        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <div className="space-y-3">
            {display.photos.length > 0 ? (
              display.photos.map((p) => (
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
            <div className="text-sm font-bold uppercase tracking-wider text-primary">
              {display.category} · {display.condition}
            </div>
            <h1 className="mt-2 font-display text-4xl tracking-wide text-ink">{title}</h1>
            {display.price_zar != null ? (
              <p className="mt-3 font-display text-3xl text-primary">
                R {display.price_zar.toLocaleString("en-ZA")}
              </p>
            ) : (
              <p className="mt-3 text-lg italic text-ink/70">
                {lang === "af" ? "Prys op aanvraag" : "Price on request"}
              </p>
            )}
            {display.location ? (
              <p className="mt-2 inline-flex items-center gap-1 text-base text-ink/70">
                <MapPin className="h-4 w-4" /> {display.location}
              </p>
            ) : null}

            <div className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-ink/80">
              {description}
            </div>

            <div className="mt-8 rounded-lg border-2 border-ink bg-card p-5 shadow-[4px_4px_0_0_var(--color-ink)]">
              <div className="font-display text-xl tracking-wide text-ink">
                {lang === "af" ? "Kontak verkoper" : "Contact seller"}
              </div>
              <p className="mt-1 text-sm text-ink/60">
                {lang === "af"
                  ? "Betaling word direk met die verkoper hanteer. Die klub is nie betrokke nie."
                  : "Payment is arranged directly with the seller. The club is not involved."}
              </p>
              {contact ? (
                <>
                  <p className="mt-4 text-lg font-semibold">{contact.contact_name}</p>
                  {phone ? (
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <a
                        href={`tel:${phone}`}
                        className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-3 text-lg font-bold text-white shadow-[3px_3px_0_0_var(--color-ink)]"
                      >
                        <Phone className="h-5 w-5" /> {t("classifieds.call")}
                      </a>
                      <a
                        href={waLink(phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-md border-2 border-ink bg-paper px-4 py-3 text-lg font-bold text-ink shadow-[3px_3px_0_0_var(--color-ink)]"
                      >
                        <MessageCircle className="h-5 w-5" /> {t("classifieds.whatsapp")}
                      </a>
                    </div>
                  ) : null}
                  <p className="mt-4 inline-flex items-center gap-2 text-base">
                    <Mail className="h-4 w-4" />
                    {revealEmail ? (
                      <a
                        href={`mailto:${emailUser}@${emailDomain}`}
                        className="underline"
                      >
                        {emailUser}@{emailDomain}
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRevealEmail(true)}
                        className="font-semibold text-primary underline"
                      >
                        {t("classifieds.showEmail")}
                      </button>
                    )}
                  </p>
                </>
              ) : session ? (
                <div className="mt-3 text-base text-ink/70">
                  <p>
                    {lang === "af"
                      ? "Slegs die verkoper en admins kan die kontakbesonderhede sien."
                      : "Only the seller and admins can see the contact details."}
                  </p>
                </div>
              ) : (
                <div className="mt-3 text-base text-ink/70">
                  <p>
                    {lang === "af"
                      ? "Teken in om die verkoper se kontakbesonderhede te sien."
                      : "Sign in to see the seller's contact details."}
                  </p>
                  <Link
                    to="/auth"
                    className="mt-3 inline-flex min-h-12 items-center rounded-md border-2 border-ink bg-primary px-5 py-3 text-base font-bold text-white"
                  >
                    {lang === "af" ? "Teken in" : "Sign in"}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
