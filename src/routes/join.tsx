import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { LOGO_URL } from "@/lib/brand";
import { Check, MessageCircle } from "lucide-react";

const SITE_ORIGIN = "https://justwheels.co.za";
const OG_LOGO = `${SITE_ORIGIN}${LOGO_URL}`;
const WA_HUGO = "https://wa.me/27836869237";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Join Just Wheels Hessequa | Free Membership" },
      {
        name: "description",
        content:
          "Membership is free. Create an account with Google or email, then WhatsApp Hugo to join the group.",
      },
      { property: "og:title", content: "Join Just Wheels Hessequa | Free Membership" },
      {
        property: "og:description",
        content: "Free membership. Create your account and WhatsApp Hugo to join.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_ORIGIN}/join` },
      { property: "og:image", content: OG_LOGO },
      { name: "twitter:image", content: OG_LOGO },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/join` }],
  }),
  component: Join,
});

function Join() {
  const { t } = useI18n();
  const benefits = [t("join.b1"), t("join.b2"), t("join.b3"), t("join.b4"), t("join.b5")];
  const steps = [
    { title: t("join.step1Title"), body: t("join.step1Body") },
    { title: t("join.step2Title"), body: t("join.step2Body") },
    { title: t("join.step3Title"), body: t("join.step3Body") },
  ];

  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <h1 className="font-display text-5xl tracking-wide text-ink sm:text-6xl">{t("join.title")}</h1>
        <p className="mt-3 text-lg text-ink/70">{t("join.subtitle")}</p>

        <div className="mt-8 rounded-lg border-2 border-ink bg-ink p-6 text-paper shadow-[4px_4px_0_0_var(--color-primary)] sm:p-8">
          <div className="font-display text-xs tracking-[0.3em] text-primary">FREE</div>
          <div className="mt-1 font-display text-4xl tracking-wide">{t("join.freeTitle")}</div>
          <p className="mt-2 text-base text-paper/80">{t("join.freeBody")}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex min-h-12 items-center justify-center rounded-md border-2 border-paper bg-primary px-6 py-3 text-base font-bold text-paper"
            >
              {t("join.google")} / {t("join.signup")}
            </Link>
            <a
              href={WA_HUGO}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border-2 border-paper bg-transparent px-6 py-3 text-base font-bold text-paper"
            >
              <MessageCircle className="h-5 w-5" /> {t("join.whatsapp")}
            </a>
          </div>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl tracking-wide text-ink">{t("join.stepsTitle")}</h2>
            <ol className="mt-4 space-y-4">
              {steps.map((s, i) => (
                <li
                  key={s.title}
                  className="flex items-start gap-3 rounded-md border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--color-ink)]"
                >
                  <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary font-display text-lg text-paper">
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-display text-xl text-ink">{s.title}</div>
                    <p className="mt-1 text-base text-ink/70">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <ul className="space-y-4">
            {benefits.map((b) => (
              <li
                key={b}
                className="flex items-start gap-3 rounded-md border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--color-ink)]"
              >
                <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary text-paper">
                  <Check className="h-4 w-4" />
                </span>
                <span className="text-base font-medium text-ink">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </SiteLayout>
  );
}
