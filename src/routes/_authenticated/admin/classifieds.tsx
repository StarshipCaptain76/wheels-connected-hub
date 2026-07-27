import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { listPendingListings, moderateListing } from "@/lib/listings.functions";
import { Check, X, Loader2 } from "lucide-react";

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

function StatusBadge({
  status,
  lang,
}: {
  status: string;
  lang: string;
}) {
  const labels: Record<string, { en: string; af: string; className: string }> = {
    pending: {
      en: "Pending",
      af: "Hangende",
      className: "border-amber-500 bg-amber-500/15 text-amber-700",
    },
    approved: {
      en: "Approved",
      af: "Goedgekeur",
      className: "border-emerald-600 bg-emerald-600/15 text-emerald-700",
    },
    rejected: {
      en: "Rejected",
      af: "Afgekeur",
      className: "border-primary bg-primary/15 text-primary",
    },
    sold: {
      en: "Sold",
      af: "Verkoop",
      className: "border-ink/40 bg-ink/10 text-ink/70",
    },
  };
  const cfg = labels[status] ?? {
    en: status,
    af: status,
    className: "border-ink/30 bg-ink/5 text-ink/60",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.className}`}
    >
      {lang === "af" ? cfg.af : cfg.en}
    </span>
  );
}

function AdminClassifieds() {
  const { lang } = useI18n();
  const { data: rows } = useSuspenseQuery(queueQuery);
  const qc = useQueryClient();
  const moderateFn = useServerFn(moderateListing);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(id: string, status: "approved" | "rejected") {
    setBusyId(id);
    try {
      await moderateFn({ data: { id, status } });
      await qc.invalidateQueries({ queryKey: ["listings"] });
      toast.success(
        lang === "af"
          ? status === "approved"
            ? "Advertensie goedgekeur"
            : "Advertensie afgekeur"
          : status === "approved"
            ? "Listing approved"
            : "Listing rejected",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(
        lang === "af" ? `Kon nie bywerk nie: ${msg}` : `Could not update: ${msg}`,
      );
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <SiteLayout>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-display text-4xl tracking-wide text-ink">
          {lang === "af" ? "Advertensie moderasie" : "Listing moderation"}
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          {pendingCount > 0 ? (
            <>
              <span className="font-bold text-amber-600">{pendingCount}</span>{" "}
              {lang === "af" ? "hangende" : "pending"}
              {pendingCount !== 1 ? (lang === "af" ? " advertensies" : " listings") : (lang === "af" ? " advertensie" : " listing")}
              {" · "}
              {rows.length} {lang === "af" ? "totaal" : "total"}
            </>
          ) : (
            <>
              {lang === "af"
                ? "Geen hangende advertensies nie"
                : "No pending listings"}
              {" · "}
              {rows.length} {lang === "af" ? "totaal" : "total"}
            </>
          )}
        </p>

        {rows.length === 0 ? (
          <div className="mt-10 rounded-2xl border-2 border-dashed border-ink/20 bg-ink/5 px-6 py-16 text-center">
            <p className="font-display text-xl text-ink/50">
              {lang === "af" ? "Nog geen advertensies nie" : "No listings yet"}
            </p>
            <p className="mt-1 text-sm text-ink/40">
              {lang === "af"
                ? "Nuwe advertensies sal hier verskyn vir goedkeuring."
                : "New member listings will appear here for approval."}
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {rows.map((l) => {
              const isPending = l.status === "pending";
              const isApproved = l.status === "approved";
              const isRejected = l.status === "rejected";
              const isBusy = busyId === l.id;

              return (
                <li
                  key={l.id}
                  className={`flex gap-4 rounded-lg border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--color-ink)] ${
                    !isPending ? "opacity-80" : ""
                  }`}
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
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={l.status} lang={lang} />
                      <span className="text-xs uppercase tracking-wider text-ink/50">
                        {l.category}
                      </span>
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
                      disabled={isBusy || isApproved}
                      onClick={() => decide(l.id, "approved")}
                      title={
                        isApproved
                          ? lang === "af"
                            ? "Reeds goedgekeur"
                            : "Already approved"
                          : lang === "af"
                            ? "Keur goed"
                            : "Approve"
                      }
                      className="rounded border-2 border-emerald-600 bg-emerald-600 p-2 text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || isRejected}
                      onClick={() => decide(l.id, "rejected")}
                      title={
                        isRejected
                          ? lang === "af"
                            ? "Reeds afgekeur"
                            : "Already rejected"
                          : lang === "af"
                            ? "Keur af"
                            : "Reject"
                      }
                      className="rounded border-2 border-primary bg-primary p-2 text-paper hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SiteLayout>
  );
}
