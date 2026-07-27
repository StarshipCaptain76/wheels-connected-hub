import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { sendMerchEnquiry } from "@/lib/merch.functions";
import { ShoppingBag, Mail } from "lucide-react";

const SITE_ORIGIN = "https://justwheels.co.za";
const OG_LOGO = `${SITE_ORIGIN}/__l5e/assets-v1/1ea9f7fc-2fa5-428f-a1df-f1a298d9caaa/justwheels-logo.jpeg`;

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop | Just Wheels Hessequa Merch" },
      {
        name: "description",
        content:
          "Club caps, tees, patches, stickers and more. Enquire online and we'll email you with payment and pickup details.",
      },
      { property: "og:title", content: "Shop | Just Wheels Hessequa Merch" },
      { property: "og:description", content: "Rep the tribe. Caps, tees, patches, stickers and more." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_ORIGIN}/shop` },
      { property: "og:image", content: OG_LOGO },
      { name: "twitter:image", content: OG_LOGO },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/shop` }],
  }),
  component: Shop,
});


type Item = {
  id: string;
  name: { en: string; af: string };
  desc: { en: string; af: string };
  price: string;
  sizes?: string[];
  emoji: string;
};

const CATALOG: Item[] = [
  {
    id: "cap-classic",
    name: { en: "Classic Club Cap", af: "Klassieke Klub Pet" },
    desc: { en: "Embroidered caveman logo. Adjustable.", af: "Geborduurde logo. Verstelbaar." },
    price: "R220",
    emoji: "🧢",
  },
  {
    id: "tee-logo",
    name: { en: "Logo Tee", af: "Logo T-Hemp" },
    desc: { en: "Heavy cotton, screen-printed front & back.", af: "Swaar katoen, voor & agter gedruk." },
    price: "R320",
    sizes: ["S", "M", "L", "XL", "XXL"],
    emoji: "👕",
  },
  {
    id: "hoodie",
    name: { en: "Workshop Hoodie", af: "Werkswinkel Hoodie" },
    desc: { en: "Fleece-lined, oil-resistant not guaranteed.", af: "Wolgevoerd, olie-bestand nie gewaarborg nie." },
    price: "R650",
    sizes: ["S", "M", "L", "XL", "XXL"],
    emoji: "🧥",
  },
  {
    id: "patch",
    name: { en: "Iron-on Patch", af: "Stryklap" },
    desc: { en: "80mm circular, full-colour.", af: "80mm rond, volkleur." },
    price: "R80",
    emoji: "🏁",
  },
  {
    id: "sticker-pack",
    name: { en: "Sticker Pack (3)", af: "Plakkerpak (3)" },
    desc: { en: "Weatherproof, for helmets, laptops and toolboxes.", af: "Weerbestand, vir helmets, skootrekenaars en gereedskapkiste." },
    price: "R60",
    emoji: "🔧",
  },
  {
    id: "mug",
    name: { en: "Enamel Camp Mug", af: "Emalje Kampbeker" },
    desc: { en: "For breakfast run coffee. 350ml.", af: "Vir ontbytry-koffie. 350ml." },
    price: "R140",
    emoji: "☕",
  },
];

function Shop() {
  const { t, lang } = useI18n();
  const [openItem, setOpenItem] = useState<Item | null>(null);

  return (
    <SiteLayout>
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 flex items-start gap-4">
          <div className="rounded-full border-2 border-ink bg-rust p-3 text-paper">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-5xl tracking-wide text-ink sm:text-6xl">{t("shop.title")}</h1>
            <p className="mt-2 max-w-2xl text-lg text-ink/70">{t("shop.subtitle")}</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-ink/60">
              <Mail className="h-4 w-4" /> {t("shop.masked")}
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOG.map((item) => (
            <article
              key={item.id}
              className="flex flex-col rounded-2xl border-2 border-ink bg-paper p-5 shadow-[4px_4px_0_0_hsl(var(--ink))]"
            >
              <div className="mb-4 flex h-32 items-center justify-center rounded-xl bg-steel/20 text-6xl">
                {item.emoji}
              </div>
              <h3 className="font-display text-2xl tracking-wide text-ink">{item.name[lang]}</h3>
              <p className="mt-1 flex-1 text-sm text-ink/70">{item.desc[lang]}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-display text-2xl text-rust">
                  <span className="text-xs uppercase tracking-widest text-ink/60">{t("shop.priceFrom")} </span>
                  {item.price}
                </span>
                <button
                  onClick={() => setOpenItem(item)}
                  className="rounded-full border-2 border-ink bg-rust px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper transition hover:-translate-y-0.5"
                >
                  {t("shop.enquire")}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {openItem && <EnquiryModal item={openItem} onClose={() => setOpenItem(null)} />}
    </SiteLayout>
  );
}

const enquirySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional(),
  size: z.string().trim().max(20).optional(),
  quantity: z.coerce.number().int().min(1).max(50),
  notes: z.string().trim().max(1000).optional(),
});

function EnquiryModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const { t, lang } = useI18n();
  const send = useServerFn(sendMerchEnquiry);
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = enquirySchema.safeParse(raw);
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
          itemId: item.id,
          itemName: item.name.en,
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone ?? "",
          size: parsed.data.size ?? "",
          quantity: parsed.data.quantity,
          notes: parsed.data.notes ?? "",
        },
      });
      setStatus("ok");
    } catch {
      setStatus("err");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border-2 border-ink bg-paper p-6 shadow-[6px_6px_0_0_hsl(var(--ink))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-ink/60">{t("shop.enquireFor")}</p>
            <h2 className="font-display text-3xl tracking-wide text-ink">{item.name[lang]}</h2>
            <p className="text-sm text-rust">{item.price}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border-2 border-ink px-3 py-1 text-sm font-bold uppercase"
          >
            ✕
          </button>
        </div>

        {status === "ok" ? (
          <div className="rounded-xl border-2 border-ink bg-rust/10 p-6 text-center">
            <p className="font-display text-2xl text-ink">{t("shop.sent")}</p>
            <button
              onClick={onClose}
              className="mt-4 rounded-full border-2 border-ink bg-ink px-4 py-2 text-sm font-bold uppercase text-paper"
            >
              {t("shop.close")}
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <Field label={t("shop.name")} name="name" required error={errors.name} />
            <Field label={t("shop.email")} name="email" type="email" required error={errors.email} />
            <Field label={t("shop.phone")} name="phone" error={errors.phone} />
            <div className="grid grid-cols-2 gap-3">
              {item.sizes ? (
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
                    {t("shop.size")}
                  </span>
                  <select
                    name="size"
                    className="mt-1 w-full rounded-lg border-2 border-ink bg-paper px-3 py-2"
                    defaultValue={item.sizes[1] ?? item.sizes[0]}
                  >
                    {item.sizes.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <input type="hidden" name="size" value="" />
              )}
              <Field
                label={t("shop.quantity")}
                name="quantity"
                type="number"
                required
                defaultValue="1"
                error={errors.quantity}
              />
            </div>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-ink/70">
                {t("shop.notes")}
              </span>
              <textarea
                name="notes"
                rows={3}
                className="mt-1 w-full rounded-lg border-2 border-ink bg-paper px-3 py-2"
              />
            </label>

            {status === "err" && (
              <p className="rounded border border-rust bg-rust/10 p-2 text-sm text-rust">
                {t("shop.error")}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-full border-2 border-ink bg-rust px-4 py-3 font-display text-lg uppercase tracking-widest text-paper disabled:opacity-60"
            >
              {status === "sending" ? t("shop.sending") : t("shop.send")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-ink/70">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border-2 border-ink bg-paper px-3 py-2"
      />
      {error && <span className="mt-1 block text-xs text-rust">{error}</span>}
    </label>
  );
}
