import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { sendContactMessage } from "@/lib/contact.functions";
import { MessageCircle } from "lucide-react";

const SITE_ORIGIN = "https://justwheels.co.za";
const OG_LOGO = `${SITE_ORIGIN}/__l5e/assets-v1/1ea9f7fc-2fa5-428f-a1df-f1a298d9caaa/justwheels-logo.jpeg`;
const WA_HUGO = "https://wa.me/27836869237";
const WA_DAWIE = "https://wa.me/27824602220";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Just Wheels Hessequa" },
      {
        name: "description",
        content:
          "Get in touch with Just Wheels Hessequa. Message the committee or WhatsApp Hugo van Dyk directly.",
      },
      { property: "og:title", content: "Contact Just Wheels Hessequa" },
      {
        property: "og:description",
        content: "Message the club or WhatsApp Hugo van Dyk directly.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_ORIGIN}/contact` },
      { property: "og:image", content: OG_LOGO },
      { name: "twitter:image", content: OG_LOGO },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/contact` }],
  }),
  component: Contact,
});

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z
    .string()
    .trim()
    .min(7, "Mobile number is required")
    .max(40)
    .regex(/^[+\d\s()-]+$/, "Enter a valid mobile number"),
  message: z.string().trim().min(1).max(1000),
});

function Contact() {
  const { t } = useI18n();
  const send = useServerFn(sendContactMessage);
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errMsg, setErrMsg] = useState<string>("");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const parsed = contactSchema.safeParse(data);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      setStatus("idle");
      return;
    }
    setErrors({});
    setStatus("sending");
    setErrMsg("");
    try {
      await send({ data: parsed.data });
      setStatus("ok");
      form.reset();
    } catch (err) {
      setStatus("err");
      setErrMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="font-display text-5xl tracking-wide text-ink sm:text-6xl">{t("contact.title")}</h1>
        <p className="mt-3 text-lg text-ink/70">{t("contact.subtitle")}</p>

        <div className="mt-10 grid gap-8 md:grid-cols-[1.4fr_1fr]">
          <form
            onSubmit={onSubmit}
            className="space-y-4 rounded-lg border-2 border-ink bg-card p-6 shadow-[4px_4px_0_0_var(--color-ink)]"
          >
            <Field name="name" label={t("contact.name")} error={errors.name} />
            <Field name="email" label={t("contact.email")} type="email" error={errors.email} />
            <Field
              name="phone"
              label={t("contact.phone")}
              type="tel"
              error={errors.phone}
              placeholder="+27 82 123 4567"
              autoComplete="tel"
            />
            <Field name="message" label={t("contact.message")} textarea error={errors.message} />
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-md border-2 border-ink bg-primary px-6 py-3 font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:opacity-60"
            >
              {status === "sending" ? "…" : t("contact.send")}
            </button>
            {status === "ok" && <p className="text-sm font-semibold text-primary">{t("contact.sent")}</p>}
            {status === "err" && (
              <p className="text-sm text-primary">{errMsg || "Could not send. Please try again."}</p>
            )}
          </form>

          <div className="space-y-4">
            <a
              href={WA_HUGO}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-md border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink bg-primary text-paper">
                <MessageCircle className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-bold uppercase tracking-wider text-ink">{t("contact.whatsapp")}</span>
                <span className="block text-sm text-ink/60">{t("contact.whatsappSub")}</span>
              </span>
            </a>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

function Field({
  name,
  label,
  type = "text",
  textarea,
  error,
  placeholder,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  textarea?: boolean;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  const base =
    "w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-primary";
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink/70">{label}</span>
      {textarea ? (
        <textarea name={name} rows={5} className={base} required maxLength={1000} />
      ) : (
        <input
          name={name}
          type={type}
          className={base}
          required
          maxLength={255}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
      )}
      {error && <span className="mt-1 block text-xs text-primary">{error}</span>}
    </label>
  );
}
