import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Images } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { ImageLightbox, type LightboxItem } from "@/components/ImageLightbox";
import { listTaggedPhotosForUser, removePhotoTag } from "@/lib/gallery-tags.functions";

/** Gallery photos this member is tagged in, shown as a scrollable carousel. */
export function TaggedPhotos({ userId, canUntag }: { userId: string; canUntag?: boolean }) {
  const { lang } = useI18n();
  const af = lang === "af";
  const listPhotos = useServerFn(listTaggedPhotosForUser);
  const [index, setIndex] = useState<number | null>(null);

  const { data: photos = [] } = useQuery({
    queryKey: ["tagged-photos", userId],
    queryFn: () => listPhotos({ data: { userId } }),
  });

  if (photos.length === 0) return null;

  const items: LightboxItem[] = photos.map((p) => ({
    url: p.image_url,
    caption: p.title || p.caption || null,
  }));

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
        <Images className="h-5 w-5 text-primary" />
        {af ? "Gemerkte foto's" : "Tagged photos"}
        <span className="text-sm font-normal text-ink/50">({photos.length})</span>
      </h2>
      <ul className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2">
        {photos.map((p, i) => (
          <li key={p.id} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setIndex(i)}
              className="block h-40 w-56 overflow-hidden rounded-xl border-2 border-ink bg-card shadow-[3px_3px_0_0_var(--color-ink)]"
            >
              <img
                src={p.image_url}
                alt={p.title ?? ""}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>
      {canUntag && (
        <p className="mt-1 text-[11px] text-ink/50">
          {af
            ? "Jy kan jouself in die galery ontmerk."
            : "You can untag yourself from a photo in the gallery."}
        </p>
      )}
      {index != null && (
        <ImageLightbox
          items={items}
          index={index}
          onClose={() => setIndex(null)}
          onIndex={setIndex}
        />
      )}
    </section>
  );
}

