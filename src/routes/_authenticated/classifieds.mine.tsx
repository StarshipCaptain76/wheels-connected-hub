import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import {
  listMyListings,
  deleteListing,
  markSold,
  type MyListing,
  type ListingStatus,
} from "@/lib/listings.functions";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";

const myListingsQuery = queryOptions({
  queryKey: ["listings", "mine"],
  queryFn: () => listMyListings(),
});

export const Route = createFileRoute("/classifieds/mine")({
  head: () => ({ meta: [{ title: "My listings — Just Wheels" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(myListingsQuery),
  component: MyListingsPage,
});

function statusColor(s: ListingStatus): string {
  switch (s) {
    case "approved":
      return "bg-emerald-600 text-white";
    case "pending":
      return "bg-amber-500 text-ink";
    case "rejected":
      return "bg-primary text-paper";
    case "sold":
      return "bg-ink text-paper";
  }
}

function MyListingsPage() {
  const { lang } = useI18n();
  const { data: listings } = useSuspenseQuery(myListingsQuery);
  const qc = useQueryClient();
  const delFn = useServerFn(deleteListing);
  const soldFn = useServerFn(markSold);

  async function onDelete(id: string) {
    if (!confirm(lang === "af" ? "Skrap hierdie advertensie?" : "Delete this listing?")) return;
    await delFn({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["listings"] });
  }
  async function onSold(id: string) {
    await soldFn({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["listings"] });
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-4xl tracking-wide text-ink">
            {lang === "af" ? "My advertensies" : "My listings"}
          </h1>
          <Link
            to="/classifieds/new"
            className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-primary px-3 py-2 text-sm font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
          >
            <Plus className="h-4 w-4" /> {lang === "af" ? "Nuwe" : "New"}
          </Link>
        </div>

        {listings.length === 0 ? (
          <p className="mt-10 text-center text-ink/60">
            {lang === "af" ? "Niks nog nie." : "Nothing yet."}
          </p>
        ) : (
          <ul className="mt-8 space-y-3">
            {listings.map((l) => (
              <MineRow key={l.id} listing={l} onDelete={onDelete} onSold={onSold} lang={lang} />
            ))}
          </ul>
        )}
      </div>
    </SiteLayout>
  );
}

function MineRow({
  listing,
  onDelete,
  onSold,
  lang,
}: {
  listing: MyListing;
  onDelete: (id: string) => void;
  onSold: (id: string) => void;
  lang: "en" | "af";
}) {
  return (
    <li className="flex items-center gap-4 rounded-lg border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--color-ink)]">
      {listing.photos[0] ? (
        <img
          src={listing.photos[0].url}
          alt=""
          className="h-16 w-16 rounded border-2 border-ink object-cover"
        />
      ) : (
        <div className="h-16 w-16 rounded border-2 border-ink bg-ink/10" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusColor(listing.status)}`}
          >
            {listing.status}
          </span>
          <span className="text-xs text-ink/60">{listing.category}</span>
        </div>
        <p className="mt-1 truncate font-display text-lg text-ink">{listing.title}</p>
      </div>
      <div className="flex items-center gap-2">
        {listing.status === "approved" ? (
          <button
            type="button"
            onClick={() => onSold(listing.id)}
            title={lang === "af" ? "Merk as verkoop" : "Mark as sold"}
            className="rounded border-2 border-ink p-1.5 hover:bg-ink hover:text-paper"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onDelete(listing.id)}
          className="rounded border-2 border-primary p-1.5 text-primary hover:bg-primary hover:text-paper"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
