import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { Check } from "lucide-react";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Join — Just Wheels Hessequa" },
      {
        name: "description",
        content:
          "Become a Just Wheels Hessequa member. Monthly runs, show-and-shines, digital member card and access to the members-only crew.",
      },
      { property: "og:title", content: "Join Just Wheels Hessequa" },
      {
        property: "og:description",
        content: "Membership benefits and pricing for the Just Wheels Hessequa car club.",
      },
      { property: "og:url", content: "https://wheels-connected-hub.lovable.app/join" },
    ],
    links: [{ rel: "canonical", href: "https://wheels-connected-hub.lovable.app/join" }],
  }),
  component: Join,
});


function Join() {
  const { t } = useI18n();
  const benefits = [
    t("join.b1"),
    t("join.b2"),
    t("join.b3"),
    t("join.b4"),
    t("join.b5"),
  ];

  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="font-display text-5xl tracking-wide text-ink sm:text-6xl">{t("join.title")}</h1>
        <p className="mt-3 text-lg text-ink/70">{t("join.subtitle")}</p>

        <div className="mt-12 grid gap-8 md:grid-cols-[1.2fr_1fr]">
          <ul className="space-y-4">
            {benefits.map((b) => (
              <li
                key={b}
                className="flex items-start gap-3 rounded-md border-2 border-ink bg-card p-4 shadow-[3px_3px_0_0_var(--color-ink)]"
              >
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-paper">
                  <Check className="h-4 w-4" />
                </span>
                <span className="font-medium text-ink">{b}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-lg border-2 border-ink bg-ink p-6 text-paper shadow-[4px_4px_0_0_var(--color-primary)]">
            <div className="font-display text-xs tracking-[0.3em] text-primary">
              {t("join.priceLabel").toUpperCase()}
            </div>
            <div className="mt-1 font-display text-5xl tracking-wide">{t("join.priceValue")}</div>
            <p className="mt-3 text-sm text-paper/70">{t("join.priceNote")}</p>
            <button
              type="button"
              className="mt-6 w-full rounded-md border-2 border-paper bg-primary px-6 py-3 font-bold uppercase tracking-wider text-paper transition-transform hover:-translate-y-0.5"
            >
              {t("join.signup")}
            </button>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
