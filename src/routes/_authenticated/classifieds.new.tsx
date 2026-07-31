import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { createListing } from "@/lib/listings.functions";
import { TranslateButton } from "@/components/TranslateButton";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, X, Upload, ChevronDown } from "lucide-react";

const searchSchema = z.object({
  from: z.enum(["browse", "mine"]).optional(),
});

export const Route = createFileRoute("/_authenticated/classifieds/new")({
  head: () => ({
    meta: [{ title: "Post a listing — Just Wheels" }],
  }),
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  component: NewListingPage,
});

type Photo = { path: string; url: string };

const PREVIEW_TTL_SEC = 60 * 60 * 12;

const fieldClass =
  "w-full rounded-md border-2 border-ink bg-paper px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary";

function NewListingPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { from } = Route.useSearch();
  const backTo = from === "browse" ? "/classifieds" : "/classifieds/mine";
  const createFn = useServerFn(createListing);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAf, setShowAf] = useState(false);

  const [title, setTitle] = useState("");
  const [titleAf, setTitleAf] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionAf, setDescriptionAf] = useState("");

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error("Not signed in");
      const uploaded: Photo[] = [];
      for (const file of Array.from(files).slice(0, 6 - photos.length)) {
        if (!file.type.startsWith("image/")) continue;
        if (file.size > 5 * 1024 * 1024) {
          setError(lang === "af" ? "Maks 5MB per foto" : "Max 5MB per photo");
          continue;
        }
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("listings")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("listings")
          .createSignedUrl(path, PREVIEW_TTL_SEC);
        uploaded.push({ path, url: signed?.signedUrl ?? "" });
      }
      setPhotos((p) => [...p, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(path: string) {
    setPhotos((prev) => prev.filter((p) => p.path !== path));
    try {
      await supabase.storage.from("listings").remove([path]);
    } catch {
      /* ignore */
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const priceRaw = String(fd.get("price_zar") ?? "").trim();
    try {
      await createFn({
        data: {
          title: title.trim(),
          title_af: (titleAf.trim() || null) as string | null,
          description: description.trim(),
          description_af: (descriptionAf.trim() || null) as string | null,
          price_zar: priceRaw ? Number(priceRaw) : null,
          category: fd.get("category") as "parts" | "cars" | "memorabilia" | "other",
          condition: fd.get("condition") as "new" | "used" | "project",
          location: (String(fd.get("location") ?? "").trim() || null) as string | null,
          contact_name: String(fd.get("contact_name") ?? ""),
          contact_phone: (String(fd.get("contact_phone") ?? "").trim() || null) as string | null,
          contact_email: String(fd.get("contact_email") ?? ""),
          photo_paths: photos.map((p) => p.path),
        },
      });
      navigate({ to: "/classifieds/mine" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
      setSubmitting(false);
    }
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link
          to={backTo}
          className="inline-flex min-h-11 items-center gap-1 text-base text-ink/70 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> {t("members.back")}
        </Link>
        <h1 className="mt-4 font-display text-4xl tracking-wide text-ink">
          {lang === "af" ? "Plaas advertensie" : "Post a listing"}
        </h1>
        <p className="mt-2 text-base text-ink/60">
          {lang === "af"
            ? "'n Admin sal jou advertensie hersien voor dit publiek verskyn."
            : "An admin will review your listing before it goes live."}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-ink">
              {lang === "af" ? "Titel" : "Title"} <span className="text-primary">*</span>
            </label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={fieldClass}
              placeholder={lang === "af" ? "bv. 1967 Mini Cooper" : "e.g. 1967 Mini Cooper"}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={lang === "af" ? "Kategorie" : "Category"}
              name="category"
              options={[
                ["cars", lang === "af" ? "Karre" : "Cars"],
                ["parts", lang === "af" ? "Onderdele" : "Parts"],
                ["memorabilia", "Memorabilia"],
                ["other", lang === "af" ? "Ander" : "Other"],
              ]}
            />
            <Select
              label={lang === "af" ? "Toestand" : "Condition"}
              name="condition"
              options={[
                ["used", lang === "af" ? "Gebruik" : "Used"],
                ["new", lang === "af" ? "Nuut" : "New"],
                ["project", lang === "af" ? "Projek" : "Project"],
              ]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={lang === "af" ? "Prys (R)" : "Price (R)"} name="price_zar" type="number" />
            <Field label={lang === "af" ? "Ligging" : "Location"} name="location" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-ink">
              {lang === "af" ? "Beskrywing" : "Description"} <span className="text-primary">*</span>
            </label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className={fieldClass}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-ink">
              {lang === "af" ? "Fotos" : "Photos"} ({photos.length}/6)
            </label>
            <div className="mb-3 flex flex-wrap gap-2">
              {photos.map((p) => (
                <div key={p.path} className="relative">
                  <img src={p.url} alt="" className="h-24 w-24 rounded border-2 border-ink object-cover" />
                  <button
                    type="button"
                    onClick={() => void removePhoto(p.path)}
                    className="absolute -right-2 -top-2 rounded-full border-2 border-ink bg-primary p-1 text-paper"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {photos.length < 6 ? (
                <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded border-2 border-dashed border-ink/50 text-ink/60 hover:border-ink hover:text-ink">
                  <Upload className="h-6 w-6" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                    disabled={uploading}
                  />
                </label>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={lang === "af" ? "Kontaknaam" : "Contact name"} name="contact_name" required />
            <Field label={lang === "af" ? "Foon (bel / WhatsApp)" : "Phone (call / WhatsApp)"} name="contact_phone" />
          </div>
          <Field label={lang === "af" ? "E-pos" : "Email"} name="contact_email" type="email" required />

          <button
            type="button"
            onClick={() => setShowAf((s) => !s)}
            className="flex w-full items-center justify-between rounded-md border-2 border-ink/30 bg-ink/5 px-4 py-3 text-left text-base font-semibold text-ink/80"
          >
            <span>{lang === "af" ? "Afrikaans / vertaling (opsioneel)" : "Afrikaans / translation (optional)"}</span>
            <ChevronDown className={`h-5 w-5 transition ${showAf ? "rotate-180" : ""}`} />
          </button>

          {showAf && (
            <div className="space-y-4 rounded-lg border-2 border-ink/20 bg-paper p-4">
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-ink">Title (AF)</span>
                  <TranslateButton source={title} from="en" to="af" onResult={setTitleAf} />
                </div>
                <input value={titleAf} onChange={(e) => setTitleAf(e.target.value)} className={fieldClass} />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-ink">Description (AF)</span>
                  <TranslateButton source={description} from="en" to="af" onResult={setDescriptionAf} />
                </div>
                <textarea
                  value={descriptionAf}
                  onChange={(e) => setDescriptionAf(e.target.value)}
                  rows={4}
                  className={fieldClass}
                />
              </div>
            </div>
          )}

          {error ? <p className="text-base text-primary">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting || uploading}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-md border-2 border-ink bg-primary px-5 py-3.5 text-base font-bold text-white shadow-[3px_3px_0_0_var(--color-ink)] disabled:opacity-50 sm:w-auto"
          >
            {submitting
              ? lang === "af"
                ? "Stuur..."
                : "Submitting..."
              : lang === "af"
                ? "Plaas advertensie"
                : "Post listing"}
          </button>
        </form>
      </div>
    </SiteLayout>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-ink">
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        step={type === "number" ? "0.01" : undefined}
        className={fieldClass}
      />
    </label>
  );
}

function Select({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-ink">{label}</span>
      <select name={name} className={fieldClass}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
