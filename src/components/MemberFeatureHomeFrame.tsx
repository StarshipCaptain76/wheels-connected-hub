import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  getHomeMemberFeature,
  type MemberFeatureHomeCard,
} from "@/lib/member-features.functions";
import { useI18n } from "@/i18n/I18nProvider";
import { Sparkles } from "lucide-react";

export function MemberFeatureHomeFrame({
  feature,
}: {
  feature?: MemberFeatureHomeCard | null;
}) {
  const { lang } = useI18n();
  const q = useHomeMemberFeature();
  const data = feature ?? q.data;

  if (!data?.slug || !data.cover_url) return null;

  const headline =
    lang === "af" && data.headline_af ? data.headline_af : data.headline_en;
  const deck = lang === "af" && data.deck_af ? data.deck_af : data.deck_en;
  const who = data.member_display_name || (lang === "af" ? "Lid" : "Member");

  return (
    <section className="border-b-2 border-ink bg-paper text-ink">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="overflow-hidden rounded-xl border-2 border-ink bg-card shadow-[4px_4px_0_0_var(--color-primary)] sm:flex">
          <div className="relative h-48 w-full shrink-0 border-b-2 border-ink sm:h-auto sm:w-56 sm:border-b-0 sm:border-r-2">
            <img src={data.cover_url} alt="" className="h-full w-full object-cover" />
            <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border-2 border-ink bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-paper">
              <Sparkles className="h-3 w-3" />
              {lang === "af" ? "Nuwe lid" : "New member"}
            </div>
          </div>
          <div className="flex flex-1 flex-col justify-center gap-2 p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              {lang === "af" ? "Nuwe lid" : "New member"}
            </p>
            <p className="font-display text-2xl leading-tight text-ink sm:text-3xl">{headline}</p>
            <p className="text-sm text-ink/70">
              {who}
              {data.member_number ? ` · #${String(data.member_number).padStart(4, "0")}` : ""}
            </p>
            {deck && (
              <p className="rounded-md border-l-4 border-primary bg-primary/5 px-3 py-2 text-sm italic leading-relaxed text-ink/85">
                {deck}
              </p>
            )}
            <Link
              to="/features/$slug"
              params={{ slug: data.slug }}
              className="mt-1 self-start rounded-md border-2 border-ink bg-paper px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink hover:bg-ink hover:text-paper"
            >
              {lang === "af" ? "Lees die storie" : "Read the story"} →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function useHomeMemberFeature() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return useQuery({
    queryKey: ["member-feature-home"],
    queryFn: async () => {
      try {
        return await getHomeMemberFeature();
      } catch (e) {
        console.error("[member-feature-home]", e);
        return null;
      }
    },
    staleTime: 60_000,
    enabled: hydrated,
  });
}
