import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Just Wheels Hessequa" },
      {
        name: "description",
        content:
          "Just Wheels Hessequa is a community car club in the Southern Cape — Riversdale, Stilbaai, Heidelberg, Albertinia. Every era, every make, every budget.",
      },
      { property: "og:title", content: "About — Just Wheels Hessequa" },
      {
        property: "og:description",
        content: "A community car club in the Southern Cape. Every era, every make, every budget.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://wheels-connected-hub.lovable.app/about" },
    ],
    links: [{ rel: "canonical", href: "https://wheels-connected-hub.lovable.app/about" }],
  }),
  component: About,
});


function About() {
  const { t } = useI18n();
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-5xl tracking-wide text-ink sm:text-6xl">{t("about.title")}</h1>
        <div className="mt-8 space-y-6 text-lg text-ink/80">
          <p>{t("about.body1")}</p>
          <p>{t("about.body2")}</p>
        </div>

        <div className="mt-12 rounded-lg border-2 border-ink bg-card p-6 shadow-[4px_4px_0_0_var(--color-ink)]">
          <h2 className="font-display text-3xl tracking-wide text-primary">{t("about.areaTitle")}</h2>
          <p className="mt-3 text-ink/80">{t("about.areaBody")}</p>
        </div>
      </section>
    </SiteLayout>
  );
}
