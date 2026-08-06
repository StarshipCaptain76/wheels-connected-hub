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
  updateMyListing,
  type MyListing,
  type ListingStatus,
} from "@/lib/listings.functions";
import {
  Plus,
  Trash2,
  EyeOff,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Pencil,
} from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";

const fieldCls = "w-full rounded border-2 border-ink bg-paper px-2 py-1.5 text-sm text-ink";

function EditMyListing({
  listing,
  lang,
  onClose,
}: {
  listing: MyListing;
  lang: "en" | "af";
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(updateMyListing);
  const [form, setForm] = useState({
    title: listing.title,
    title_af: listing.title_af ?? "",
    description: listing.description,
    description_af: listing.description_af ?? "",
    price_zar: listing.price_zar == null ? "" : String(listing.price_zar),
    category: listing.category,
    condition: listing.condition,
    location: listing.location ?? "",
    contact_name: listing.contact?.contact_name ?? "",
    contact_phone: listing.contact?.contact_phone ?? "",
    contact_email: listing.contact?.contact_email ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await save({
        data: {
          id: listing.id,
          title: form.title.trim(),
          title_af: form.title_af.trim() || null,
          description: form.description.trim(),
          description_af: form.description_af.trim() || null,
          price_zar: form.price_zar.trim() === "" ? null : Number(form.price_zar),
          category: form.category,
          condition: form.condition,
          location: form.location.trim() || null,
          contact_name: form.contact_name.trim(),
          contact_phone: form.contact_phone.trim() || null,
          contact_email: form.contact_email.trim(),
        },
      });
      await qc.invalidateQueries({ queryKey: ["listings"] });
      toast.success(
        lang === "af"
          ? "Gestoor — wag weer op goedkeuring"
          : "Saved — sent back for admin approval",
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-3 space-y-2 rounded-lg border-2 border-dashed border-ink/40 p-3"
    >
      <p className="text-xs text-ink/60">
        {lang === "af"
          ? "Wysigings word weer deur 'n admin goedgekeur voor dit publiek wys."
          : "Edits go back to an admin for re-approval before showing publicly."}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className={fieldCls}
          required
          maxLength={120}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder={lang === "af" ? "Titel (EN)" : "Title (EN)"}
        />
        <input
          className={fieldCls}
          maxLength={120}
          value={form.title_af}
          onChange={(e) => setForm({ ...form, title_af: e.target.value })}
          placeholder="Titel (AF)"
        />
      </div>
      <textarea
        className={fieldCls}
        required
        rows={3}
        maxLength={4000}
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder={lang === "af" ? "Beskrywing (EN)" : "Description (EN)"}
      />
      <textarea
        className={fieldCls}
        rows={3}
        maxLength={4000}
        value={form.description_af}
        onChange={(e) => setForm({ ...form, description_af: e.target.value })}
        placeholder="Beskrywing (AF)"
      />
      <div className="grid gap-2 sm:grid-cols-4">
        <input
          className={fieldCls}
          type="number"
          min="0"
          value={form.price_zar}
          onChange={(e) => setForm({ ...form, price_zar: e.target.value })}
          placeholder={lang === "af" ? "Prys (R)" : "Price (R)"}
        />
        <select
          className={fieldCls}
          value={form.category}
          onChange={(e) =>
            setForm({ ...form, category: e.target.value as MyListing["category"] })
          }
        >
          <option value="parts">parts</option>
          <option value="cars">cars</option>
          <option value="memorabilia">memorabilia</option>
          <option value="other">other</option>
        </select>
        <select
          className={fieldCls}
          value={form.condition}
          onChange={(e) =>
            setForm({ ...form, condition: e.target.value as MyListing["condition"] })
          }
        >
          <option value="new">new</option>
          <option value="used">used</option>
          <option value="project">project</option>
        </select>
        <input
          className={fieldCls}
          maxLength={120}
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          placeholder={lang === "af" ? "Dorp" : "Location"}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          className={fieldCls}
          required
          maxLength={120}
          value={form.contact_name}
          onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
          placeholder={lang === "af" ? "Kontaknaam" : "Contact name"}
        />
        <input
          className={fieldCls}
          maxLength={40}
          value={form.contact_phone}
          onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
          placeholder={lang === "af" ? "Selfoon" : "Phone"}
        />
        <input
          className={fieldCls}
          required
          type="email"
          maxLength={200}
          value={form.contact_email}
          onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
          placeholder="Email"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md border-2 border-ink bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {lang === "af" ? "Stoor" : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border-2 border-ink bg-paper px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink"
        >
          {lang === "af" ? "Kanselleer" : "Cancel"}
        </button>
      </div>
    </form>
  );
}


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
  const confirm = useConfirm();

  async function run(id: string, action: "delete" | "sold") {
    if (action === "delete") {
      const ok = await confirm({
        title: lang === "af" ? "Skrap hierdie advertensie?" : "Delete this listing?",
        description:
          lang === "af"
            ? "Dit kan nie ontdoen word nie."
            : "This cannot be undone.",
        confirmLabel: lang === "af" ? "Skrap" : "Delete",
        cancelLabel: lang === "af" ? "Kanselleer" : "Cancel",
      });
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
