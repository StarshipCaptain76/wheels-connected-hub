import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { listPendingListings, moderateListing } from "@/lib/listings.functions";
import { Check, X } from "lucide-react";

const queueQuery = queryOptions({
  queryKey: ["listings", "moderation"],
  queryFn: () => listPendingListings(),
});

export const Route = createFileRoute("/_authenticated/admin/classifieds")({
  head: () => ({ meta: [{ title: "Moderation — Just Wheels" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(queueQuery),
  component: AdminClassifieds,
  errorComponent: ({ error }) => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-ink/70">Access denied: {error.message}</p>
      </div>
    </SiteLayout>
  ),
});

function AdminClassifieds() {
  const { lang } = useI18n();
  const { data: rows } = useSuspenseQuery(queueQuery);
  const qc = useQueryClient();
  const moderateFn = useServerFn(moderateListing);

  async function decide(id: string, status: "approved" | "rejected") {
    await moderateFn({ data: { id, status } });
    await qc.invalidateQueries({ queryKey: ["listings"] });
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-display text-4xl tracking-wide text-ink">
          {lang === "af" ? "Advertensie moderasie" : "Listing moderation"}
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          {rows.length} {lang === "af" ? "advertensies" : "listings"}
        </p>

        <ul className="mt-6 space-y-4">
          {rows.map((l) => (
            <li
              key={l.id}
              className="flex gap-4 rounded-lg border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--color-ink)]"
            >
              {l.photos[0] ? (
                <img
                  src={l.photos[0].url}
                  alt=""
                  className="h-24 w-24 rounded border-2 border-ink object-cover"
                />
              ) : (
                <div className="h-24 w-24 rounded border-2 border-ink bg-ink/10" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs uppercase tracking-wider text-primary">
                  {l.status} · {l.category}
                </div>
                <p className="mt-1 font-display text-lg text-ink">{l.title}</p>
                <p className="line-clamp-2 text-sm text-ink/70">{l.description}</p>
                <p className="mt-1 text-xs text-ink/60">
                  {l.contact?.contact_name} · {l.contact?.contact_email}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => decide(l.id, "approved")}
                  className="rounded border-2 border-emerald-600 bg-emerald-600 p-2 text-white hover:opacity-90"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => decide(l.id, "rejected")}
                  className="rounded border-2 border-primary bg-primary p-2 text-paper hover:opacity-90"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </SiteLayout>
  );
}
