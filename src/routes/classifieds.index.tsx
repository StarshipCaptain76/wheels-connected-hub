import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  listApprovedListings,
  type ListingCategory,
  type PublicListing,
} from "@/lib/listings.functions";
import { Tag } from "lucide-react";

const listingsQuery = queryOptions({
  queryKey: ["listings", "approved"],
  queryFn: () => listApprovedListings(),
  staleTime: 30_000,
});

export const Route = createFileRoute("/classifieds/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(listingsQuery),
  component: ClassifiedsPage,
  pendingComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-ink/60">Loading…</div>
    </SiteLayout>
  ),
});

const CATEGORIES: { value: ListingCategory | "all"; en: string; af: string }[] = [
  { value: "all", en: "All", af: "Alles" },
  { value: "cars", en: "Cars", af: "Karre" },
  { value: "parts", en: "Parts", af: "Onderdele" },
  { value: "memorabilia", en: "Memorabilia", af: "Memorabilia" },
  { value: "other", en: "Other", af: "Ander" },
];

function ClassifiedsPage() {
  const { t, lang } = useI18n();
  const { data: listings } = useSuspenseQuery(listingsQuery);
  const [cat, setCat] = useState<ListingCategory | "all">("all");
  const [q, setQ] = useState("");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSignedIn(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(Boolean(session));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const filtered = listings.filter((l) => {
    if (cat !== "all" && l.category !== cat) return false;
    if (q.trim()) {
      const hay = `${l.title} ${l.title_af ?? ""} ${l.description}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  return (
    <SiteLayout>
      <section className="border-b-2 border-ink bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="mb-3 inline-block rounded-full border-2 border-primary bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-primary">
            {t("nav.classifieds")}
          </div>
          <h1 className="font-display text-5xl tracking-wide sm:text-6xl">
            {lang === "af" ? "Klub Markplek" : "Club Marketplace"}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-paper/80">
            {lang === "af"
              ? "Karre, onderdele en items te koop deur klublede. Kontak die verkoper direk."
              : "Cars, parts and gear for sale by club members. Contact the seller directly — no payments run through the club."}
          </p>
          <div className="mt-6">
            {signedIn ? (
              <Link
                to="/classifieds/new"
                search={{ from: "browse" }}
                className="inline-flex rounded-md border-2 border-primary bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-paper)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
              >
                {t("classifieds.postCta")}
              </Link>
            ) : (
              <Link
                to="/auth"
                className="inline-flex rounded-md border-2 border-primary bg-transparent px-4 py-2 text-sm font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary hover:text-paper"
              >
                {lang === "af" ? "Teken in om te plaas" : "Sign in to post"}
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCat(c.value)}
              className={`rounded-full border-2 border-ink px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors ${
                cat === c.value ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-ink/5"
              }`}
            >
              {lang === "af" ? c.af : c.en}
            </button>
          ))}
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={lang === "af" ? "Soek..." : "Search..."}
            className="ml-auto w-48 rounded-md border-2 border-ink bg-paper px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-ink/30 bg-card p-12 text-center">
            <p className="font-display text-2xl text-ink">
              {lang === "af" ? "Geen advertensies nie." : "Nothing listed yet."}
            </p>
            <p className="mt-2 text-ink/60">
              {lang === "af"
                ? "Wees die eerste — plaas jou item."
                : "Be the first — post something."}
            </p>
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((l) => (
              <ListingCard key={l.id} listing={l} lang={lang} />
            ))}
          </ul>
        )}
      </section>
    </SiteLayout>
  );
}

function ListingCard({ listing, lang }: { listing: PublicListing; lang: "en" | "af" }) {
  const title = lang === "af" && listing.title_af ? listing.title_af : listing.title;
  const cover = listing.photos[0]?.url;
  return (
    <li className="group overflow-hidden rounded-lg border-2 border-ink bg-card shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1">
      <Link to="/classifieds/$id" params={{ id: listing.id }} className="block">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="h-48 w-full border-b-2 border-ink object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="h-32 w-full border-b-2 border-ink"
            style={{
              background:
                "repeating-linear-gradient(45deg, var(--color-primary) 0 12px, var(--color-ink) 12px 24px)",
            }}
            aria-hidden
          />
        )}
        <div className="p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <Tag className="h-3.5 w-3.5" />
            {listing.category}
          </div>
          <h2 className="mt-2 font-display text-xl tracking-wide text-ink line-clamp-2">{title}</h2>
          {listing.price_zar != null ? (
            <p className="mt-2 font-display text-lg text-ink">
              R {listing.price_zar.toLocaleString("en-ZA")}
            </p>
          ) : (
            <p className="mt-2 text-sm italic text-ink/60">
              {lang === "af" ? "Prys op aanvraag" : "Price on request"}
            </p>
          )}
          {listing.location ? <p className="mt-1 text-xs text-ink/60">{listing.location}</p> : null}
        </div>
      </Link>
    </li>
  );
}
