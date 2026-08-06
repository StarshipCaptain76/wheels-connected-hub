import { createFileRoute } from "@tanstack/react-router";
import {
  queryOptions,
  useSuspenseQuery,
  useQueryClient,
  useQuery,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";
import {
  listPendingListings,
  moderateListing,
  adminUpdateListing,
  adminCreateListing,
  type MyListing,
} from "@/lib/listings.functions";
import { listAllMembers, type AdminMember } from "@/lib/admin-members.functions";
import { Check, X, Loader2, Pencil, Plus } from "lucide-react";

const queueQuery = queryOptions({
  queryKey: ["listings", "moderation"],
  queryFn: () => listPendingListings(),
});

export const Route = createFileRoute("/_authenticated/admin/classifieds")({
  head: () => ({ meta: [{ title: "Moderation — Just Wheels" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(queueQuery),
  component: AdminClassifieds,
  errorComponent: ({ error }) => (
    <div className="py-20 text-center">
      <p className="text-ink/70">Access denied: {error.message}</p>
    </div>
  ),
});

const CATEGORY_LABELS: Record<string, { en: string; af: string }> = {
  cars: { en: "Cars", af: "Karre" },
  parts: { en: "Parts", af: "Onderdele" },
  memorabilia: { en: "Memorabilia", af: "Memorabilia" },
  other: { en: "Other", af: "Ander" },
};

function StatusBadge({ status, lang }: { status: string; lang: string }) {
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

const field = "w-full rounded border-2 border-ink bg-paper px-2 py-1 text-sm text-ink";

function EditListing({
  listing,
  lang,
  onClose,
}: {
  listing: MyListing;
  lang: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(adminUpdateListing);
  const [form, setForm] = useState({
    title: listing.title,
    title_af: listing.title_af ?? "",
    description: listing.description,
    description_af: listing.description_af ?? "",
    price_zar: listing.price_zar == null ? "" : String(listing.price_zar),
    category: listing.category,
    condition: listing.condition,
    location: listing.location ?? "",
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
        },
      });
      await qc.invalidateQueries({ queryKey: ["listings"] });
      toast.success(lang === "af" ? "Advertensie gestoor" : "Listing saved");
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
      className="mt-3 space-y-2 rounded border-2 border-dashed border-ink/40 p-3"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className={field}
          value={form.title}
          maxLength={120}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder={lang === "af" ? "Titel" : "Title"}
        />
        <input
          className={field}
          value={form.title_af}
          maxLength={120}
          onChange={(e) => setForm({ ...form, title_af: e.target.value })}
          placeholder={lang === "af" ? "Titel (Afr)" : "Title (Afrikaans)"}
        />
      </div>
      <textarea
        className={field}
        rows={3}
        maxLength={4000}
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder={lang === "af" ? "Beskrywing" : "Description"}
      />
      <textarea
        className={field}
        rows={3}
        maxLength={4000}
        value={form.description_af}
        onChange={(e) => setForm({ ...form, description_af: e.target.value })}
        placeholder={lang === "af" ? "Beskrywing (Afr)" : "Description (Afrikaans)"}
      />
      <div className="grid gap-2 sm:grid-cols-4">
        <input
          className={field}
          type="number"
          min={0}
          value={form.price_zar}
          onChange={(e) => setForm({ ...form, price_zar: e.target.value })}
          placeholder={lang === "af" ? "Prys (R)" : "Price (R)"}
        />
        <select
          className={field}
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value as MyListing["category"] })}
        >
          {Object.keys(CATEGORY_LABELS).map((c) => (
            <option key={c} value={c}>
              {lang === "af" ? CATEGORY_LABELS[c]!.af : CATEGORY_LABELS[c]!.en}
            </option>
          ))}
        </select>
        <select
          className={field}
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
          className={field}
          maxLength={120}
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          placeholder={lang === "af" ? "Plek" : "Location"}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded border-2 border-ink bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
        >
          {saving ? (lang === "af" ? "Stoor…" : "Saving…") : lang === "af" ? "Stoor" : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded border-2 border-ink bg-paper px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-ink"
        >
          {lang === "af" ? "Kanselleer" : "Cancel"}
        </button>
      </div>
    </form>
  );
}

function NewListingForMember({ lang, onClose }: { lang: string; onClose: () => void }) {
  const qc = useQueryClient();
  const create = useServerFn(adminCreateListing);
  const { data: members = [] } = useQuery<AdminMember[]>({
    queryKey: ["admin", "members"],
    queryFn: () => listAllMembers(),
  });
  const [form, setForm] = useState({
    owner_user_id: "",
    title: "",
    title_af: "",
    description: "",
    description_af: "",
    price_zar: "",
    category: "cars" as MyListing["category"],
    condition: "used" as MyListing["condition"],
    location: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    status: "approved" as "approved" | "pending",
  });
  const [saving, setSaving] = useState(false);

  function pickMember(id: string) {
    const m = members.find((x) => x.user_id === id);
    setForm((f) => ({
      ...f,
      owner_user_id: id,
      contact_name: m?.display_name ?? f.contact_name,
      contact_email: m?.email ?? f.contact_email,
      contact_phone: m?.phone ?? f.contact_phone,
      location: f.location || (m?.town ?? ""),
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.owner_user_id) {
      toast.error(lang === "af" ? "Kies 'n lid" : "Choose a member");
      return;
    }
    setSaving(true);
    try {
      await create({
        data: {
          owner_user_id: form.owner_user_id,
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
          status: form.status,
        },
      });
      await qc.invalidateQueries({ queryKey: ["listings"] });
      toast.success(lang === "af" ? "Advertensie geskep" : "Listing created");
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
      className="mt-4 space-y-2 rounded-lg border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--color-ink)]"
    >
      <p className="font-display text-lg text-ink">
        {lang === "af" ? "Nuwe advertensie vir 'n lid" : "New listing for a member"}
      </p>
      <select className={field} value={form.owner_user_id} onChange={(e) => pickMember(e.target.value)}>
        <option value="">
          {lang === "af" ? "Kies lid (eienaar)…" : "Choose member (owner)…"}
        </option>
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            #{m.member_number} · {m.display_name ?? m.email ?? m.user_id}
          </option>
        ))}
      </select>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className={field}
          value={form.title}
          maxLength={120}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder={lang === "af" ? "Titel" : "Title"}
        />
        <input
          className={field}
          value={form.title_af}
          maxLength={120}
          onChange={(e) => setForm({ ...form, title_af: e.target.value })}
          placeholder={lang === "af" ? "Titel (Afr)" : "Title (Afrikaans)"}
        />
      </div>
      <textarea
        className={field}
        rows={3}
        maxLength={4000}
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder={lang === "af" ? "Beskrywing" : "Description"}
      />
      <div className="grid gap-2 sm:grid-cols-4">
        <input
          className={field}
          type="number"
          min={0}
          value={form.price_zar}
          onChange={(e) => setForm({ ...form, price_zar: e.target.value })}
          placeholder={lang === "af" ? "Prys (R)" : "Price (R)"}
        />
        <select
          className={field}
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value as MyListing["category"] })}
        >
          {Object.keys(CATEGORY_LABELS).map((c) => (
            <option key={c} value={c}>
              {lang === "af" ? CATEGORY_LABELS[c]!.af : CATEGORY_LABELS[c]!.en}
            </option>
          ))}
        </select>
        <select
          className={field}
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
          className={field}
          maxLength={120}
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          placeholder={lang === "af" ? "Plek" : "Location"}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          className={field}
          value={form.contact_name}
          maxLength={120}
          onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
          placeholder={lang === "af" ? "Kontaknaam" : "Contact name"}
        />
        <input
          className={field}
          value={form.contact_email}
          maxLength={200}
          onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
          placeholder={lang === "af" ? "Kontak e-pos" : "Contact email"}
        />
        <input
          className={field}
          value={form.contact_phone}
          maxLength={40}
          onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
          placeholder={lang === "af" ? "Kontak foon" : "Contact phone"}
        />
      </div>
      <select
        className={field}
        value={form.status}
        onChange={(e) => setForm({ ...form, status: e.target.value as "approved" | "pending" })}
      >
        <option value="approved">
          {lang === "af" ? "Publiseer dadelik (goedgekeur)" : "Publish now (approved)"}
        </option>
        <option value="pending">
          {lang === "af" ? "Hou hangend vir hersiening" : "Hold as pending"}
        </option>
      </select>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded border-2 border-ink bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
        >
          {saving ? (lang === "af" ? "Stoor…" : "Saving…") : lang === "af" ? "Skep" : "Create"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded border-2 border-ink bg-paper px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-ink"
        >
          {lang === "af" ? "Kanselleer" : "Cancel"}
        </button>
      </div>
    </form>
  );
}

function AdminClassifieds() {
  const { lang } = useI18n();
  const { data: rows } = useSuspenseQuery(queueQuery);
  const qc = useQueryClient();
  const moderateFn = useServerFn(moderateListing);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

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
      toast.error(lang === "af" ? `Kon nie bywerk nie: ${msg}` : `Could not update: ${msg}`);
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div>
      <h1 className="font-display text-3xl tracking-wide text-ink sm:text-4xl">
        {lang === "af" ? "Advertensie moderasie" : "Listing moderation"}
      </h1>
      <p className="mt-2 text-sm text-ink/60">
        {pendingCount > 0 ? (
          <>
            <span className="font-bold text-amber-600">{pendingCount}</span>{" "}
            {lang === "af" ? "hangende" : "pending"}
            {pendingCount !== 1
              ? lang === "af"
                ? " advertensies"
                : " listings"
              : lang === "af"
                ? " advertensie"
                : " listing"}
            {" · "}
            {rows.length} {lang === "af" ? "totaal" : "total"}
          </>
        ) : (
          <>
            {lang === "af" ? "Geen hangende advertensies nie" : "No pending listings"}
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
                className={`rounded-lg border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--color-ink)] ${
                  !isPending ? "opacity-80" : ""
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  {l.photos[0] ? (
                    <img
                      src={l.photos[0].url}
                      alt=""
                      className="h-32 w-full rounded border-2 border-ink object-cover sm:h-24 sm:w-24 sm:flex-none"
                    />
                  ) : (
                    <div className="h-24 w-full rounded border-2 border-ink bg-ink/10 sm:w-24 sm:flex-none" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={l.status} lang={lang} />
                      <span className="text-xs uppercase tracking-wider text-ink/50">
                        {lang === "af"
                          ? (CATEGORY_LABELS[l.category]?.af ?? l.category)
                          : (CATEGORY_LABELS[l.category]?.en ?? l.category)}
                      </span>
                    </div>
                    <p className="mt-1 font-display text-lg text-ink">{l.title}</p>
                    <p className="line-clamp-2 text-sm text-ink/70">{l.description}</p>
                    <p className="mt-1 text-xs text-ink/60">
                      {l.contact?.contact_name} · {l.contact?.contact_email}
                    </p>
                  </div>
                  <div className="flex flex-row gap-2 sm:flex-col">
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
                    <button
                      type="button"
                      onClick={() => setEditId(editId === l.id ? null : l.id)}
                      title={lang === "af" ? "Wysig" : "Edit"}
                      className="rounded border-2 border-ink bg-paper p-2 text-ink hover:opacity-90"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {editId === l.id && (
                  <EditListing listing={l} lang={lang} onClose={() => setEditId(null)} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
