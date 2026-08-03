import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import {
  listMerchItems,
  sendMerchEnquiry,
  merchWhatsAppHref,
  type MerchItem,
} from "@/lib/merch.functions";
import { ShoppingBag, Mail, Package, X, MapPin } from "lucide-react";
import { ImageLightbox, type LightboxItem } from "@/components/ImageLightbox";

const SITE_ORIGIN = "https://justwheels.co.za";
const OG_LOGO = `${SITE_ORIGIN}/__l5e/assets-v1/1ea9f7fc-2fa5-428f-a1df-f1a298d9caaa/justwheels-logo.jpeg`;

function formatPrice(n: number) {
  return `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const shopQuery = queryOptions({
  queryKey: ["merch", "public"],
  queryFn: () => listMerchItems(),
  staleTime: 60_000,
});

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
  loader: ({ context }) => context.queryClient.ensureQueryData(shopQuery),
  component: Shop,
});

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function Shop() {
  const { t, lang } = useI18n();
  const { data: items } = useSuspenseQuery(shopQuery);
  const [openItem, setOpenItem] = useState<MerchItem | null>(null);
  const [photo, setPhoto] = useState<LightboxItem | null>(null);

  return (
    <SiteLayout>
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 flex items-start gap-4">
          <div className="rounded-full border-2 border-ink bg-rust p-3 text-paper">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-5xl tracking-wide text-ink sm:text-6xl">
              {t("shop.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-lg text-ink/70">{t("shop.subtitle")}</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-ink/60">
              <Mail className="h-4 w-4" /> {t("shop.masked")}
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-ink/30 bg-card p-12 text-center">
            <Package className="mx-auto h-10 w-10 text-ink/40" />
            <p className="mt-4 font-display text-2xl text-ink">
              {lang === "af" ? "Winkel is binnekort oop." : "The shop is opening soon."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const name = lang === "af" && item.name_af ? item.name_af : item.name;
              const desc =
                lang === "af" && item.description_af ? item.description_af : item.description;
              const waMessage =
                lang === "af"
                  ? `Hallo! Ek stel belang in: ${name}${item.price_zar != null ? ` (${formatPrice(item.price_zar)})` : ""}`
                  : `Hi! I'm interested in: ${name}${item.price_zar != null ? ` (${formatPrice(item.price_zar)})` : ""}`;
              const waHref = merchWhatsAppHref(item.whatsapp_number, waMessage);

              return (
                <article
                  key={item.id}
                  className="flex flex-col rounded-2xl border-2 border-ink bg-paper p-5 shadow-[4px_4px_0_0_hsl(var(--ink))]"
                >
                  <div className="mb-4 flex h-32 items-center justify-center overflow-hidden rounded-xl bg-steel/20">
                    {item.image_url ? (
                      <button
                        type="button"
                        onClick={() => setPhoto({ url: item.image_url!, caption: name })}
                        aria-label={
                          lang === "af" ? `Bekyk foto van ${name}` : `View photo of ${name}`
                        }
                        className="h-full w-full cursor-zoom-in"
                      >
                        <img
                          src={item.image_url}
                          alt={name}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ) : (
                      <Package className="h-14 w-14 text-ink/40" />
                    )}
                  </div>
                  <h2 className="font-display text-2xl tracking-wide text-ink">{name}</h2>
                  {desc && <p className="mt-1 flex-1 text-sm text-ink/70">{desc}</p>}
                  {item.available_from?.trim() && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-ink/60">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        <span className="font-bold uppercase tracking-wider">
                          {lang === "af" ? "Beskikbaar by" : "Available from"}:
                        </span>{" "}
                        {item.available_from.trim()}
                      </span>
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="font-display text-2xl text-rust">
                      {item.price_zar != null ? (
                        <>
                          <span className="text-xs uppercase tracking-widest text-ink/60">
                            {t("shop.priceFrom")}{" "}
                          </span>
                          {formatPrice(item.price_zar)}
                        </>
                      ) : (
                        <span className="text-sm italic text-ink/60">
                          {lang === "af" ? "Prys op aanvraag" : "Price on request"}
                        </span>
                      )}
                    </span>
                    {waHref ? (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-ink bg-[#25D366] px-4 py-2 text-sm font-bold uppercase tracking-wider text-white transition hover:-translate-y-0.5 hover:bg-[#20BD5A]"
                      >
                        <WhatsAppIcon className="h-4 w-4" />
                        WhatsApp
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOpenItem(item)}
                        className="shrink-0 rounded-full border-2 border-ink bg-rust px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper transition hover:-translate-y-0.5"
                      >
                        {t("shop.enquire")}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {openItem && <EnquiryModal item={openItem} onClose={() => setOpenItem(null)} />}

      {photo && (
        <ImageLightbox
          items={[photo]}
          index={0}
          onClose={() => setPhoto(null)}
          onIndex={() => {}}
        />
      )}
    </SiteLayout>
  );
}

const enquirySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional(),
  size: z.string().trim().max(40).optional(),
  quantity: z.coerce.number().int().min(1).max(50),
  notes: z.string().trim().max(1000).optional(),
});

function EnquiryModal({ item, onClose }: { item: MerchItem; onClose: () => void }) {
  const { t, lang } = useI18n();
  const send = useServerFn(sendMerchEnquiry);
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const displayName = lang === "af" && item.name_af ? item.name_af : item.name;

  // Auto-close ~2s after successful send
  useEffect(() => {
    if (status !== "ok") return;
    const timer = window.setTimeout(() => onClose(), 2000);
    return () => window.clearTimeout(timer);
  }, [status, onClose]);

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
          itemName: item.name,
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
            <h2 className="font-display text-3xl tracking-wide text-ink">{displayName}</h2>
            {item.price_zar != null && (
              <p className="text-sm text-rust">{formatPrice(item.price_zar)}</p>
            )}
            {item.available_from?.trim() && (
              <p className="mt-1 flex items-center gap-1 text-xs text-ink/60">
                <MapPin className="h-3 w-3" />
                {lang === "af" ? "Beskikbaar by" : "Available from"}: {item.available_from.trim()}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full border-2 border-ink p-1.5 hover:bg-ink/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {status === "ok" ? (
          <div className="rounded-xl border-2 border-ink bg-emerald-50 p-6 text-center">
            <p className="font-display text-2xl text-ink">{t("shop.sent")}</p>
            <p className="mt-2 text-sm text-ink/60">
              {lang === "af"
                ? "Hierdie venster maak outomaties toe…"
                : "This window will close automatically…"}
            </p>
            <button
              type="button"
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
              {item.sizes.length > 0 ? (
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
              <div className="rounded border-2 border-primary bg-primary/10 p-3 text-sm text-primary">
                <p>{t("shop.error")}</p>
                <button
                  type="button"
                  onClick={() => setStatus("idle")}
                  className="mt-2 text-xs font-bold uppercase underline"
                >
                  {lang === "af" ? "Probeer weer" : "Try again"}
                </button>
              </div>
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
