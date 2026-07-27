import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { applySponsor, listSponsors, type Sponsor } from "@/lib/sponsors.functions";
import {
  Handshake,
  Mail,
  ExternalLink,
  ChevronDown,
  Share2,
  MessageCircle,
  Link2,
  Check,
} from "lucide-react";

const SITE_ORIGIN = "https://justwheels.co.za";
const OG_LOGO = `${SITE_ORIGIN}/__l5e/assets-v1/1ea9f7fc-2fa5-428f-a1df-f1a298d9caaa/justwheels-logo.jpeg`;

export const Route = createFileRoute("/sponsors")({
  head: () => ({
    meta: [
      { title: "Sponsors | Just Wheels Hessequa" },
      {
        name: "description",
        content:
          "Meet the businesses that keep Just Wheels Hessequa on the road — and apply to become a club sponsor.",
      },
      { property: "og:title", content: "Sponsors | Just Wheels Hessequa" },
      { property: "og:description", content: "Our supporters and how to become a club sponsor." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_ORIGIN}/sponsors` },
      { property: "og:image", content: OG_LOGO },
      { name: "twitter:image", content: OG_LOGO },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/sponsors` }],
  }),
  component: Sponsors,
});

function Sponsors() {
  const { t, lang } = useI18n();
  const { data: sponsors = [] } = useQuery({
    queryKey: ["sponsors"],
    queryFn: () => listSponsors(),
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Open sponsor from hash link e.g. /sponsors#sponsor-<id>
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash.startsWith("sponsor-")) {
      const id = hash.slice("sponsor-".length);
      setExpandedId(id);
      // Scroll into view after paint
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [sponsors]);

  return (
    <SiteLayout>
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 flex items-start gap-4">
          <div className="rounded-full border-2 border-ink bg-rust p-3 text-paper">
            <Handshake className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-5xl tracking-wide text-ink sm:text-6xl">
              {t("sponsors.pageTitle")}
            </h1>
            <p className="mt-2 max-w-2xl text-lg text-ink/70">{t("sponsors.pageIntro")}</p>
          </div>
        </div>

        {sponsors.length > 0 && (
          <div className="mb-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sponsors.map((s) => (
              <SponsorCard
                key={s.id}
                sponsor={s}
                lang={lang}
                expanded={expandedId === s.id}
                onToggle={() =>
                  setExpandedId((cur) => {
                    const next = cur === s.id ? null : s.id;
                    if (next) {
                      history.replaceState(null, "", `#sponsor-${s.id}`);
                    } else if (window.location.hash === `#sponsor-${s.id}`) {
                      history.replaceState(null, "", window.location.pathname);
                    }
                    return next;
                  })
                }
                visitLabel={t("sponsors.visit")}
              />
            ))}
          </div>
        )}

        <ApplyForm />
      </section>
    </SiteLayout>
  );
}

function SponsorCard({
  sponsor,
  lang,
  expanded,
  onToggle,
  visitLabel,
}: {
  sponsor: Sponsor;
  lang: "en" | "af";
  expanded: boolean;
  onToggle: () => void;
  visitLabel: string;
}) {
  const tag = lang === "af" ? sponsor.tagline_af ?? sponsor.tagline : sponsor.tagline;
  const shareUrl = `${SITE_ORIGIN}/sponsors#sponsor-${sponsor.id}`;
  const shareText =
    lang === "af"
      ? `Kyk na ${sponsor.name} — 'n borg van Just Wheels Hessequa`
      : `Check out ${sponsor.name} — a Just Wheels Hessequa sponsor`;

  return (
    <div
      id={`sponsor-${sponsor.id}`}
      className={`flex flex-col rounded-2xl border-2 border-ink bg-paper shadow-[4px_4px_0_0_hsl(var(--ink))] transition-shadow ${
        expanded ? "sm:col-span-2 lg:col-span-3 shadow-[6px_6px_0_0_hsl(var(--ink))]" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col p-5 text-left"
        aria-expanded={expanded}
      >
        <div
          className={`flex items-center justify-center rounded-xl bg-steel/20 p-4 ${
            expanded ? "h-40 sm:h-48" : "h-32"
          }`}
        >
          <img
            src={sponsor.logo_url}
            alt={sponsor.name}
            className="max-h-full max-w-full object-contain"
          />
        </div>
        <div className="mt-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display text-2xl tracking-wide text-ink">{sponsor.name}</h3>
            {tag && !expanded && (
              <p className="mt-1 line-clamp-2 text-sm text-ink/70">{tag}</p>
            )}
          </div>
          <ChevronDown
            className={`mt-1 h-5 w-5 shrink-0 text-ink/50 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t-2 border-ink/10 px-5 pb-5">
          {tag && <p className="mt-4 text-base text-ink/80">{tag}</p>}

          <div className="mt-5 flex flex-wrap gap-2">
            {sponsor.website_url && (
              <a
                href={sponsor.website_url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="inline-flex items-center gap-1.5 rounded-md border-2 border-ink bg-rust px-3 py-2 text-xs font-bold uppercase tracking-wider text-paper"
              >
                {visitLabel} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <div className="mt-5">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-ink/50">
              <Share2 className="h-3 w-3" />
              {lang === "af" ? "Deel hierdie borg" : "Share this sponsor"}
            </p>
            <div className="flex flex-wrap gap-2">
              <ShareWhatsApp name={sponsor.name} text={shareText} url={shareUrl} lang={lang} />
              <ShareEmail name={sponsor.name} text={shareText} url={shareUrl} lang={lang} />
              <ShareCopy url={shareUrl} lang={lang} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShareWhatsApp({
  text,
  url,
  lang,
}: {
  name: string;
  text: string;
  url: string;
  lang: "en" | "af";
}) {
  const href = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border-2 border-ink bg-paper px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink hover:bg-ink/5"
    >
      <MessageCircle className="h-3.5 w-3.5" />
      WhatsApp
    </a>
  );
}

function ShareEmail({
  text,
  url,
  lang,
}: {
  name: string;
  text: string;
  url: string;
  lang: "en" | "af";
}) {
  const subject =
    lang === "af" ? "Just Wheels borg" : "Just Wheels sponsor";
  const body = `${text}\n\n${url}`;
  const href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md border-2 border-ink bg-paper px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink hover:bg-ink/5"
    >
      <Mail className="h-3.5 w-3.5" />
      {lang === "af" ? "E-pos" : "Email"}
    </a>
  );
}

function ShareCopy({ url, lang }: { url: string; lang: "en" | "af" }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md border-2 border-ink bg-paper px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink hover:bg-ink/5"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Link2 className="h-3.5 w-3.5" />}
      {copied
        ? lang === "af"
          ? "Gekopieer"
          : "Copied"
        : lang === "af"
          ? "Kopieer skakel"
          : "Copy link"}
    </button>
  );
}

const applySchema = z.object({
  business: z.string().trim().min(1).max(120),
  contact: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional(),
  website: z.string().trim().max(255).optional(),
  message: z.string().trim().max(2000).optional(),
});

function ApplyForm() {
  const { t } = useI18n();
  const send = useServerFn(applySponsor);
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = applySchema.safeParse(raw);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
      setErrors(fe);
      return;
    }
    setErrors({});
    setStatus("sending");
    try {
      await send({
        data: {
          business: parsed.data.business,
          contact: parsed.data.contact,
          email: parsed.data.email,
          phone: parsed.data.phone ?? "",
          website: parsed.data.website ?? "",
          message: parsed.data.message ?? "",
        },
      });
      setStatus("ok");
      e.currentTarget.reset();
    } catch {
      setStatus("err");
    }
  };

  return (
    <div className="rounded-2xl border-2 border-ink bg-paper p-6 shadow-[4px_4px_0_0_hsl(var(--ink))]">
      <h2 className="font-display text-3xl tracking-wide text-ink">{t("sponsors.applyTitle")}</h2>
      <p className="mt-2 flex items-center gap-2 text-sm text-ink/70">
        <Mail className="h-4 w-4" /> {t("sponsors.applyIntro")}
      </p>

      {status === "ok" ? (
        <div className="mt-6 rounded-xl border-2 border-ink bg-rust/10 p-6">
          <p className="font-display text-2xl text-ink">{t("sponsors.sent")}</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <F label={t("sponsors.business")} name="business" required error={errors.business} />
          <F label={t("sponsors.contact")} name="contact" required error={errors.contact} />
          <F label={t("sponsors.email")} name="email" type="email" required error={errors.email} />
          <F label={t("sponsors.phone")} name="phone" error={errors.phone} />
          <F label={t("sponsors.website")} name="website" error={errors.website} className="sm:col-span-2" />
          <label className="block sm:col-span-2">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
              {t("sponsors.message")}
            </span>
            <textarea
              name="message"
              rows={4}
              className="mt-1 w-full rounded-lg border-2 border-ink bg-paper px-3 py-2"
            />
          </label>

          {status === "err" && (
            <p className="rounded border border-rust bg-rust/10 p-2 text-sm text-rust sm:col-span-2">
              {t("sponsors.error")}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "sending"}
            className="rounded-full border-2 border-ink bg-rust px-4 py-3 font-display text-lg uppercase tracking-widest text-paper disabled:opacity-60 sm:col-span-2"
          >
            {status === "sending" ? t("sponsors.sending") : t("sponsors.send")}
          </button>
        </form>
      )}
    </div>
  );
}

function F({
  label,
  name,
  type = "text",
  required,
  error,
  className = "",
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  error?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-bold uppercase tracking-wider text-ink/70">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-1 w-full rounded-lg border-2 border-ink bg-paper px-3 py-2"
      />
      {error && <span className="mt-1 block text-xs text-rust">{error}</span>}
    </label>
  );
}
