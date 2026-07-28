import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import {
  listMyListings,
  deleteListing,
  markSold,
  type MyListing,
  type ListingStatus,
} from "@/lib/listings.functions";
import { Plus, Trash2, EyeOff, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";

const myListingsQuery = queryOptions({
  queryKey: ["listings", "mine"],
  queryFn: () => listMyListings(),
});

export const Route = createFileRoute("/_authenticated/classifieds/mine")({
  head: () => ({ meta: [{ title: "My listings — Just Wheels" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(myListingsQuery),
  component: MyListingsPage,
});

function statusLabel(s: ListingStatus, lang: "en" | "af"): string {
  const map: Record<ListingStatus, { en: string; af: string }> = {
    approved: { en: "Live", af: "Aktief" },
    pending: { en: "Pending review", af: "Wag op goedkeuring" },
    rejected: { en: "Rejected", af: "Afgekeur" },
    sold: { en: "Sold / delisted", af: "Verkoop / verwyder" },
  };
  return lang === "af" ? map[s].af : map[s].en;
}

function statusColor(s: ListingStatus): string {
  switch (s) {
    case "approved":
      return "bg-emerald-600 text-white";
    case "pending":
      return "bg-amber-500 text-black";
    case "rejected":
      return "bg-primary text-white";
    case "sold":
      return "bg-black text-white";
  }
}

function MyListingsPage() {
  const { lang } = useI18n();
  const { data: listings } = useSuspenseQuery(myListingsQuery);
  const qc = useQueryClient();
  const delFn = useServerFn(deleteListing);
  const soldFn = useServerFn(markSold);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(id: string, action: "delete" | "sold") {
    if (action === "delete") {
      const ok = confirm(
        lang === "af"
          ? "Skrap hierdie advertensie permanent? Dit kan nie ontdoen word nie."
          : "Permanently delete this listing? This cannot be undone.",
      );
      if (!ok) return;
    }
    setBusyId(id);
    try {
      if (action === "delete") {
        await delFn({ data: { id } });
        toast.success(lang === "af" ? "Advertensie geskrap" : "Listing deleted");
      } else {
        await soldFn({ data: { id } });
        toast.success(
          lang === "af"
            ? "Advertensie van die markplek verwyder"
            : "Listing removed from the marketplace",
        );
      }
      await qc.invalidateQueries({ queryKey: ["listings"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(lang === "af" ? `Kon nie bywerk nie: ${msg}` : `Could not update: ${msg}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link
          to="/classifieds"
          className="mb-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-ink/60 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {lang === "af" ? "Terug na markplek" : "Back to marketplace"}
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl tracking-wide text-ink">
              {lang === "af" ? "My advertensies" : "My listings"}
            </h1>
            <p className="mt-1 text-sm text-ink/60">
              {lang === "af"
                ? "Verwyder van die markplek, merk as verkoop, of skrap permanent."
                : "Delist from the marketplace, mark as sold, or delete permanently."}
            </p>
          </div>
          <Link
            to="/classifieds/new"
            search={{ from: "mine" }}
            className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-primary px-3 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[3px_3px_0_0_var(--color-ink)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
          >
            <Plus className="h-4 w-4" /> {lang === "af" ? "Nuwe" : "New"}
          </Link>
        </div>

        {listings.length === 0 ? (
          <div className="mt-10 rounded-2xl border-2 border-dashed border-ink/25 bg-paper px-6 py-16 text-center">
            <p className="font-display text-xl text-ink/50">
              {lang === "af" ? "Nog geen advertensies nie." : "No listings yet."}
            </p>
            <Link
              to="/classifieds/new"
              search={{ from: "mine" }}
              className="mt-4 inline-flex rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-white"
            >
              {lang === "af" ? "Plaas jou eerste" : "Post your first"}
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {listings.map((l) => (
              <MineRow
                key={l.id}
                listing={l}
                busy={busyId === l.id}
                onDelist={() => run(l.id, "sold")}
                onDelete={() => run(l.id, "delete")}
                lang={lang}
              />
            ))}
          </ul>
        )}
      </div>
    </SiteLayout>
  );
}

function MineRow({
  listing,
  busy,
  onDelist,
  onDelete,
  lang,
}: {
  listing: MyListing;
  busy: boolean;
  onDelist: () => void;
  onDelete: () => void;
  lang: "en" | "af";
}) {
  const isLive = listing.status === "approved";
  const isPending = listing.status === "pending";
  const isGone = listing.status === "sold" || listing.status === "rejected";

  return (
    <li className="flex flex-col gap-3 rounded-lg border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--color-ink)] sm:flex-row sm:items-center">
      {listing.photos[0] ? (
        <img
          src={listing.photos[0].url}
          alt=""
          className="h-20 w-full rounded border-2 border-ink object-cover sm:h-16 sm:w-16"
        />
      ) : (
        <div className="h-16 w-full rounded border-2 border-ink bg-ink/10 sm:w-16" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusColor(listing.status)}`}
          >
            {statusLabel(listing.status, lang)}
          </span>
          <span className="text-xs uppercase tracking-wider text-ink/50">{listing.category}</span>
        </div>
        <p className="mt-1 truncate font-display text-lg text-ink">{listing.title}</p>
        {listing.price_zar != null && (
          <p className="text-sm text-ink/70">R {listing.price_zar.toLocaleString("en-ZA")}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(isLive || isPending) && (
          <button
            type="button"
            disabled={busy}
            onClick={onDelist}
            title={
              lang === "af"
                ? "Verwyder van markplek (merk as verkoop / versteek)"
                : "Remove from marketplace (mark sold / hide)"
            }
            className="inline-flex items-center gap-1.5 rounded-md border-2 border-ink bg-paper px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink hover:bg-ink hover:text-white disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isLive ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {lang === "af" ? "Verwyder" : "Delist"}
          </button>
        )}

        {isGone && (
          <span className="text-xs text-ink/50">
            {lang === "af" ? "Nie meer openbaar nie" : "Not public"}
          </span>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          title={lang === "af" ? "Skrap permanent" : "Delete permanently"}
          className="inline-flex items-center gap-1.5 rounded-md border-2 border-primary bg-paper px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary hover:text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          {lang === "af" ? "Skrap" : "Delete"}
        </button>
      </div>
    </li>
  );
}
