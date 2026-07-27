import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { applySponsor, listSponsors } from "@/lib/sponsors.functions";
import { Handshake, Mail, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/sponsors")({
  head: () => ({
    meta: [
      { title: "Sponsors — Just Wheels Hessequa" },
      {
        name: "description",
        content:
          "Meet the businesses that keep Just Wheels Hessequa on the road — and apply to become a club sponsor.",
      },
      { property: "og:title", content: "Just Wheels Hessequa — Sponsors" },
      { property: "og:description", content: "Our supporters + how to become a club sponsor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Sponsors,
});

function Sponsors() {
  const { t, lang } = useI18n();
  const { data: sponsors = [] } = useQuery({
    queryKey: ["sponsors"],
    queryFn: () => listSponsors(),
  });

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
            {sponsors.map((s) => {
              const tag = lang === "af" ? s.tagline_af ?? s.tagline : s.tagline;
              return (
                <div
                  key={s.id}
                  className="flex flex-col rounded-2xl border-2 border-ink bg-paper p-5 shadow-[4px_4px_0_0_hsl(var(--ink))]"
                >
                  <div className="flex h-32 items-center justify-center rounded-xl bg-steel/20 p-4">
                    <img
                      src={s.logo_url}
                      alt={s.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <h3 className="mt-4 font-display text-2xl tracking-wide text-ink">{s.name}</h3>
                  {tag && <p className="mt-1 flex-1 text-sm text-ink/70">{tag}</p>}
                  {s.website_url && (
                    <a
                      href={s.website_url}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="mt-4 inline-flex items-center gap-1 text-sm font-bold uppercase tracking-wider text-rust"
                    >
                      {t("sponsors.visit")} <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <ApplyForm />
      </section>
    </SiteLayout>
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
