import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { getMyProfile, type MemberProfile } from "@/lib/profile.functions";
import { CACHED_PROFILE_KEY } from "@/lib/members-cache";
import logoAsset from "@/assets/justwheels-logo.jpeg.asset.json";
import { WifiOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/members/card")({
  head: () => ({
    meta: [
      { title: "Member card — Just Wheels Hessequa" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MemberCardPage,
});

function readCache(): MemberProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHED_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as MemberProfile) : null;
  } catch {
    return null;
  }
}

function MemberCardPage() {
  const { t } = useI18n();
  const fetchProfile = useServerFn(getMyProfile);
  const [cached, setCached] = useState<MemberProfile | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setCached(readCache());
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const query = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => fetchProfile(),
    enabled: isOnline,
    retry: false,
  });

  useEffect(() => {
    if (query.data) {
      try {
        window.localStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(query.data));
      } catch {}
      setCached(query.data);
    }
  }, [query.data]);

  const profile = query.data ?? cached;

  return (
    <SiteLayout>
      <section className="mx-auto max-w-lg px-4 py-10">
        <div className="mb-4 flex items-center justify-between">
          <Link
            to="/members"
            className="text-xs font-bold uppercase tracking-widest text-ink/60 hover:text-ink"
          >
            ← {t("members.back")}
          </Link>
          {!isOnline && (
            <span className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-paper px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-ink">
              <WifiOff className="h-3 w-3" /> {t("card.offline")}
            </span>
          )}
        </div>

        {!profile ? (
          <p className="text-ink/60">{t("card.needSync")}</p>
        ) : (
          <MemberCard profile={profile} />
        )}
      </section>
    </SiteLayout>
  );
}

function MemberCard({ profile }: { profile: MemberProfile }) {
  const { t, lang } = useI18n();
  const year = new Date(profile.joined_at).getFullYear();
  const number = String(profile.member_number).padStart(4, "0");

  return (
    <article
      aria-label="Just Wheels Hessequa member card"
      className="relative overflow-hidden rounded-3xl border-4 border-ink bg-gradient-to-br from-ink via-ink to-[oklch(0.22_0.02_20)] p-6 text-paper shadow-[8px_8px_0_0_var(--color-primary)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/20 blur-2xl"
      />

      <header className="flex items-center gap-3">
        <img
          src={logoAsset.url}
          alt=""
          className="h-14 w-14 rounded-full border-2 border-paper object-cover"
        />
        <div>
          <div className="font-display text-2xl leading-none tracking-wide">JUST WHEELS</div>
          <div className="text-xs tracking-[0.3em] text-primary">HESSEQUA</div>
        </div>
        <span className="ml-auto rounded-full border border-paper/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-paper/80">
          {lang === "af" ? "Lidkaart" : "Member"}
        </span>
      </header>

      <div className="mt-8">
        <p className="font-display text-xs tracking-[0.3em] text-primary">
          {t("card.number")}
        </p>
        <p className="font-display text-5xl leading-none tracking-wider">#{number}</p>
      </div>

      <div className="mt-6 grid gap-2">
        <div className="font-display text-2xl leading-tight">
          {profile.display_name ?? "—"}
        </div>
        <div className="text-sm text-paper/70">
          {profile.favourite_ride || t("card.noRide")}
        </div>
      </div>

      <footer className="mt-8 flex items-end justify-between text-[11px] uppercase tracking-widest text-paper/70">
        <div>
          <div className="text-paper/50">{t("card.member")}</div>
          <div className="text-paper">{t("card.since")} {year}</div>
        </div>
        <div className="text-right">
          <div className="text-paper/50">{t("card.status")}</div>
          <div className="text-primary">{profile.membership_status}</div>
        </div>
      </footer>
    </article>
  );
}
