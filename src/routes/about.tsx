import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { LOGO_URL } from "@/lib/brand";
import { Mail, MessageCircle } from "lucide-react";

const SITE_ORIGIN = "https://justwheels.co.za";
const OG_LOGO = `${SITE_ORIGIN}${LOGO_URL}`;
/** Founder photo — place file at public/oom-johan.jpeg */
const FOUNDER_PHOTO = "/oom-johan.jpeg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Just Wheels Hessequa | Southern Cape Car Club" },
      {
        name: "description",
        content:
          "Just Wheels Hessequa — founded by Johan Beetge, from Brakpan to Stilbaai. A community car club with oil under the fingernails and stories to tell.",
      },
      { property: "og:title", content: "About Just Wheels Hessequa | Southern Cape Car Club" },
      {
        property: "og:description",
        content:
          "From Brakpan to Lappiesbaai — the story of Just Wheels Hessequa and Oom Johan Beetge.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_ORIGIN}/about` },
      { property: "og:image", content: OG_LOGO },
      { name: "twitter:image", content: OG_LOGO },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/about` }],
  }),
  component: About,
});

function About() {
  const { t, lang } = useI18n();
  const af = lang === "af";

  return (
    <SiteLayout>
      <section className="border-b-2 border-ink bg-ink text-paper">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
            {af ? "Oor die klub" : "About the club"}
          </p>
          <h1 className="mt-2 font-display text-5xl tracking-wide sm:text-6xl">
            {af ? "Gebou met olie onder die naels" : "Built with oil under the nails"}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-paper/75">
            {af
              ? "'n Handjievol okes, 'n paar koeldranke, en 'n idee wat geweier het om stil te sit. Vandag is Just Wheels Hessequa nog steeds meer garage as raadsaal."
              : "A handful of okes, a few cold drinks, and an idea that refused to sit still. Today Just Wheels Hessequa is still more garage than boardroom."}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12">
        {/* Founder */}
        <article className="overflow-hidden rounded-2xl border-2 border-ink bg-card shadow-[6px_6px_0_0_var(--color-ink)]">
          <div className="grid gap-0 sm:grid-cols-[1.1fr_1fr]">
            <div className="relative min-h-[260px] bg-ink/10">
              <img
                src={FOUNDER_PHOTO}
                alt={af ? "Johan Beetge — stigter van Just Wheels" : "Johan Beetge — founder of Just Wheels"}
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
                {af ? "Die stigter" : "The founder"}
              </p>
              <h2 className="mt-1 font-display text-3xl tracking-wide text-ink sm:text-4xl">
                Johan Beetge
              </h2>
              <p className="mt-1 text-sm font-semibold text-ink/55">
                {af ? "Oom Johan — soos die klub hom onthou" : "Oom Johan — as the club remembers him"}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-ink/80">
                {af
                  ? "Hy het die wiele in Brakpan begin laat draai, en toe hy kus toe trek na Stilbaai, het die passie saamgetrek. Hier in Hessequa het hy die klub voortgesit — dieselfde gees, net met see-lug in die bande."
                  : "He got the wheels turning in Brakpan, and when he moved coastward to Stilbaai the passion packed its bags too. Here in Hessequa he carried the club on — same spirit, just with sea air in the tyres."}
              </p>
            </div>
          </div>
        </article>

        <div className="mt-10 rounded-2xl border-2 border-ink bg-primary p-6 text-paper shadow-[4px_4px_0_0_var(--color-ink)] sm:p-8">
          <div className="flex items-start gap-4">
            <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-paper/30 bg-paper/10">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-paper/80">
                {af ? "Die oorsprong" : "The origin"}
              </p>
              <h2 className="mt-1 font-display text-3xl tracking-wide text-paper sm:text-4xl">
                {t("about.originTitle")}
              </h2>
              <p className="mt-3 text-paper/90">{t("about.originBody")}</p>
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-6 text-lg leading-relaxed text-ink/80">
          <p>
            {af
              ? "Die eerste Just Wheels bymekaarkoms hier was by die Lappiesbaai parkeerterrein — laat 2016 of vroeg 2017, afhangende van wie se geheue jy vra en of daar al koffie in was. Niemand het notules geneem nie. Ons was te besig om karre te kyk en stories te ruil."
              : "The first Just Wheels get-together down here was at the Lappiesbaai car park — late 2016 or early 2017, depending on whose memory you ask and whether the coffee had kicked in. Nobody took minutes. We were too busy looking at cars and swapping stories."}
          </p>
          <p>
            {af
              ? "Van daardie eerste byeenkoms het 'n klub gegroei wat vandag nog een van die aktiefste motorgroepe in die Suid-Kaap is. Ons lede wissel van concours-gehalte restoureerders tot ouens wat Saterdagoggend nog by die skrootwerf onderdele haal. Almal is welkom — solank jy dit liefhet."
              : "From that first meet-up grew a club that is still one of the most active motoring groups on the Southern Cape. Our members range from concours-quality restorers to guys still fetching parts from the scrapyard on a Saturday morning. Everyone's welcome — as long as you love it."}
          </p>
          <p>
            {af
              ? "Johan is nie meer by ons nie. Maar sy passie hardloop steeds in die klub en in sy lede — in elke ontbytrit, elke show-and-shine, en elke swaaiende sleutelring by die braai. Ons ry verder omdat hy die pad oopgemaak het."
              : "Johan is no longer with us. But his passion still runs in the club and in its members — in every breakfast run, every show-and-shine, and every swinging keyring at the braai. We keep rolling because he opened the road."}
          </p>
        </div>

        <div className="mt-12 rounded-2xl border-2 border-ink bg-paper p-6 shadow-[4px_4px_0_0_var(--color-ink)]">
          <h2 className="font-display text-3xl tracking-wide text-primary">
            {af ? "Waar ons ry" : "Where we ride"}
          </h2>
          <p className="mt-3 text-ink/80">
            {af
              ? "Gebaseer in die Hessequa munisipaliteit: Riversdal, Stilbaai, Heidelberg, Albertinia, Gouritsmond, Witsand. Ritte strek langs die Tuinroete en die Klein Karoo — enige plek met 'n pad, 'n parking en 'n storie."
              : "Based in the Hessequa municipality: Riversdale, Stilbaai, Heidelberg, Albertinia, Gouritsmond, Witsand. Runs stretch along the Garden Route and the Klein Karoo — anywhere with a road, a parking spot and a story."}
          </p>
        </div>

        <div className="mt-8 rounded-2xl border-2 border-dashed border-ink/40 bg-steel/10 p-6">
          <h2 className="font-display text-2xl tracking-wide text-ink">
            {af ? "Hierdie bladsy is 'n lewende ding" : "This page is a living thing"}
          </h2>
          <p className="mt-3 text-ink/75">
            {af
              ? "Ons werk dit voortdurend by soos stories, fotos en herinneringe inkom. Het jy 'n anekdote, 'n ou foto van Lappiesbaai, of 'n stukkie klubgeskiedenis wat nog nie hier is nie? Stuur dit asseblief. Ons sal dit met 'n glimlag (en dalk 'n bietjie olie) byvoeg."
              : "We keep updating it as stories, photos and memories roll in. Got an anecdote, an old Lappiesbaai photo, or a scrap of club history that isn't here yet? Please send it through. We'll add it with a grin (and maybe a smudge of oil)."}
          </p>
          <a
            href="mailto:admin@justwheels.co.za?subject=Club%20history%20%2F%20stories"
            className="mt-4 inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
          >
            <Mail className="h-4 w-4" />
            admin@justwheels.co.za
          </a>
          <p className="mt-2 text-xs text-ink/50">
            {af
              ? "Onderwerp: klubgeskiedenis / stories — stuur teks of fotos."
              : "Subject: club history / stories — text or photos welcome."}
          </p>
        </div>

        <p className="mt-10 text-center font-display text-xl tracking-wide text-ink/50">
          {af ? "As dit wiele het, hoort dit hier." : "If it's got wheels, it belongs here."}
        </p>
      </section>
    </SiteLayout>
  );
}
