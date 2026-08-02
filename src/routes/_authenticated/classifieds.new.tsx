import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { createListing } from "@/lib/listings.functions";
import { TranslateButton } from "@/components/TranslateButton";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, X, Upload } from "lucide-react";
import { CharCounter } from "@/components/CharCounter";

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

/** Preview signed URLs valid for 12 hours (long form sessions). */
const PREVIEW_TTL_SEC = 60 * 60 * 12;

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
    // Best-effort: delete orphan from storage (D2)
    try {
      await supabase.storage.from("listings").remove([path]);
    } catch {
      /* ignore — file may already be gone */
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
          className="inline-flex items-center gap-1 text-sm text-ink/70 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> {t("members.back")}
        </Link>
        <h1 className="mt-4 font-display text-4xl tracking-wide text-ink">
          {lang === "af" ? "Plaas advertensie" : "Post a listing"}
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          {lang === "af"
            ? "'n Admin sal jou advertensie hersien voor dit publiek verskyn."
            : "An admin will review your listing before it goes live."}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-sm font-bold uppercase tracking-wider text-ink">
                {lang === "af" ? "Titel (EN)" : "Title (EN)"} <span className="text-primary">*</span>
              </span>
              <TranslateButton source={titleAf} from="af" to="en" onResult={setTitle} />
            </div>
            <input
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border-2 border-ink bg-paper px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <CharCounter value={title} max={120} />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-sm font-bold uppercase tracking-wider text-ink">Title (AF)</span>
              <TranslateButton source={title} from="en" to="af" onResult={setTitleAf} />
            </div>
            <input
              maxLength={120}
              value={titleAf}
              onChange={(e) => setTitleAf(e.target.value)}
              className="w-full rounded-md border-2 border-ink bg-paper px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <CharCounter value={titleAf} max={120} />
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
            <Field label={lang === "af" ? "Ligging" : "Location"} name="location" maxLength={120} />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-sm font-bold uppercase tracking-wider text-ink">
                {lang === "af" ? "Beskrywing (EN)" : "Description (EN)"}{" "}
                <span className="text-primary">*</span>
              </span>
              <TranslateButton source={descriptionAf} from="af" to="en" onResult={setDescription} />
            </div>
            <textarea
              required
              maxLength={4000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full rounded-md border-2 border-ink bg-paper px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <CharCounter value={description} max={4000} />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-sm font-bold uppercase tracking-wider text-ink">Description (AF)</span>
              <TranslateButton source={description} from="en" to="af" onResult={setDescriptionAf} />
            </div>
            <textarea
              maxLength={4000}
              value={descriptionAf}
              onChange={(e) => setDescriptionAf(e.target.value)}
              rows={5}
              className="w-full rounded-md border-2 border-ink bg-paper px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <CharCounter value={descriptionAf} max={4000} />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-ink">
              {lang === "af" ? "Fotos" : "Photos"} ({photos.length}/6)
            </label>
            <div className="mb-3 flex flex-wrap gap-2">
              {photos.map((p) => (
                <div key={p.path} className="relative">
                  <img src={p.url} alt="" className="h-20 w-20 rounded border-2 border-ink object-cover" />
                  <button
                    type="button"
                    onClick={() => void removePhoto(p.path)}
                    className="absolute -right-2 -top-2 rounded-full border-2 border-ink bg-primary p-0.5 text-paper"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {photos.length < 6 ? (
                <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded border-2 border-dashed border-ink/50 text-ink/60 hover:border-ink hover:text-ink">
                  <Upload className="h-5 w-5" />
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
            <Field label={lang === "af" ? "Kontaknaam" : "Contact name"} name="contact_name" required maxLength={120} />
            <Field label={lang === "af" ? "Foon" : "Phone"} name="contact_phone" maxLength={40} />
          </div>
          <Field label={lang === "af" ? "E-pos" : "Email"} name="contact_email" type="email" required maxLength={200} />

          {error ? <p className="text-sm text-primary">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting || uploading}
            className="inline-flex rounded-md border-2 border-ink bg-primary px-5 py-2.5 font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:opacity-50"
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
  maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  const [value, setValue] = useState("");
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold uppercase tracking-wider text-ink">
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        maxLength={maxLength}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        step={type === "number" ? "0.01" : undefined}
        className="w-full rounded-md border-2 border-ink bg-paper px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {maxLength ? <CharCounter value={value} max={maxLength} /> : null}
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
      <span className="mb-1 block text-sm font-bold uppercase tracking-wider text-ink">{label}</span>
      <select
        name={name}
        className="w-full rounded-md border-2 border-ink bg-paper px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
