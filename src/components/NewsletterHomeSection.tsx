import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download, Eye } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { listPublishedEditions } from "@/lib/newsletter-editions.functions";

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_AF = [
  "Januarie", "Februarie", "Maart", "April", "Mei", "Junie",
  "Julie", "Augustus", "September", "Oktober", "November", "Desember",
];

/** "From the workshop" — latest published newsletter edition + archive links. */
export function NewsletterHomeSection() {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const isAf = lang === "af";
  const { data } = useQuery({
    queryKey: ["newsletter-editions", "published"],
    queryFn: () => listPublishedEditions(),
    staleTime: 300_000,
  });

  const editions = data ?? [];
  if (editions.length === 0) return null;

  const latest = editions[0];
  const older = editions.slice(1, 7);
  const label = (y: number, m: number) => `${(isAf ? MONTHS_AF : MONTHS_EN)[m - 1]} ${y}`;
  const title = (isAf && latest.title_af ? latest.title_af : latest.title_en) || label(latest.year, latest.month);
  const body = (isAf && latest.body_af ? latest.body_af : latest.body_en) || "";
  // Serve the reader's language: Afrikaans file when available, otherwise English.
  const pdfLang = isAf && latest.pdf_path_af ? "&lang=af" : "";

  return (
    <section className="border-b-2 border-ink bg-card text-ink">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-display text-sm tracking-widest text-primary">
            {isAf ? "UIT DIE WERKSWINKEL" : "FROM THE WORKSHOP"}
          </span>
        </div>

        <div className="rounded-xl border-2 border-ink bg-paper p-5 shadow-[4px_4px_0_0_var(--color-ink)]">
          <div className="text-xs font-bold uppercase tracking-wider text-ink/60">
            {label(latest.year, latest.month)}
          </div>
          <h2 className="mt-1 font-display text-3xl tracking-wide">{title}</h2>

          <div className="mt-5 flex flex-wrap gap-3">
            {latest.pdf_path && (
              <a
                href={`/api/public/newsletter-pdf?id=${latest.id}&dl=1${pdfLang}`}
                className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
              >
                <Download className="h-4 w-4" /> {isAf ? "Laai PDF af" : "Download PDF"}
              </a>
            )}
            {body && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-paper px-4 py-2 text-sm font-bold uppercase tracking-wider text-ink shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
              >
                <Eye className="h-4 w-4" />
                {open
                  ? isAf ? "Verberg brief" : "Hide letter"
                  : isAf ? "Lees brief" : "Read letter"}
              </button>
            )}
          </div>

          {open && body && (
            <div
              className="prose-sm mt-5 max-w-2xl border-t-2 border-dashed border-ink/20 pt-4 text-sm leading-relaxed text-ink/80 [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2"
              // Newsletter copy is authored by club admins only.
              dangerouslySetInnerHTML={{ __html: body }}
            />
          )}
        </div>


        {older.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/50">
              {isAf ? "Vorige uitgawes" : "Past editions"}
            </span>
            {older.map((e) => (
              <a
                key={e.id}
                href={`/api/public/newsletter-pdf?id=${e.id}${isAf && e.pdf_path_af ? "&lang=af" : ""}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border-2 border-ink bg-paper px-3 py-1 text-xs font-bold hover:bg-primary hover:text-paper"
              >
                {label(e.year, e.month)}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
