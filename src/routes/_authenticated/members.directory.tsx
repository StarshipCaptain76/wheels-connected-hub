import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { MemberCard, pickFacePhoto } from "@/components/MemberCard";
import { useI18n } from "@/i18n/I18nProvider";
import {
  listDirectoryMembers,
  listDirectoryTowns,
  type DirectoryMember,
  type DirectorySort,
} from "@/lib/directory.functions";
import { ArrowLeft, Search, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/members/directory")({
  head: () => ({
    meta: [
      { title: "Club members — Just Wheels Hessequa" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DirectoryPage,
});

function rideLine(m: DirectoryMember): string | null {
  if (m.favourite_ride?.trim()) return m.favourite_ride.trim();
  const v = m.primary_vehicle;
  if (!v) return null;
  const parts = [v.year, v.make, v.model].filter(Boolean).join(" ");
  if (v.nickname && parts) return `${v.nickname} · ${parts}`;
  return v.nickname || parts || null;
}

function DirectoryPage() {
  const { t, lang } = useI18n();
  const fetchList = useServerFn(listDirectoryMembers);
  const fetchTowns = useServerFn(listDirectoryTowns);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<DirectorySort>("name");
  const [town, setTown] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);

  const queryKey = useMemo(
    () => ["directory", search.trim(), sort, town, featuredOnly] as const,
    [search, sort, town, featuredOnly],
  );

  const { data: members = [], isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () =>
      fetchList({
        data: {
          search: search.trim(),
          sort,
          town,
          featuredOnly,
        },
      }),
    staleTime: 30_000,
  });

  const { data: towns = [] } = useQuery({
    queryKey: ["directory-towns"],
    queryFn: () => fetchTowns(),
    staleTime: 60_000,
  });

  return (
    <SiteLayout>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <Link
          to="/members"
          className="mb-4 inline-flex items-center gap-2 text-sm text-ink/60 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {lang === "af" ? "Terug na Die Garage" : "Back to The Garage"}
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-xs tracking-[0.3em] text-primary">
              {t("directory.kicker")}
            </p>
            <h1 className="font-display text-4xl tracking-wide text-ink sm:text-5xl">
              {t("directory.title")}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-ink/60">{t("directory.subtitle")}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-paper px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-ink/70">
            <Users className="h-3.5 w-3.5 text-primary" />
            {isLoading ? "…" : `${members.length} ${t("directory.count")}`}
          </div>
        </div>

        <div className="mt-6 space-y-3 rounded-2xl border-2 border-ink bg-paper p-4 shadow-[4px_4px_0_0_var(--color-ink)] sm:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("directory.searchPlaceholder")}
              className="w-full rounded-md border-2 border-ink bg-paper py-2.5 pl-10 pr-3 text-sm"
              aria-label={t("directory.searchPlaceholder")}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink/50">
                {t("directory.sort")}
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as DirectorySort)}
                className="rounded-md border-2 border-ink bg-paper px-2 py-2 text-sm"
              >
                <option value="name">{t("directory.sortName")}</option>
                <option value="number">{t("directory.sortNumber")}</option>
                <option value="joined_desc">{t("directory.sortJoinedNew")}</option>
                <option value="joined_asc">{t("directory.sortJoinedOld")}</option>
                <option value="vehicle_oldest">{t("directory.sortVehicleOld")}</option>
                <option value="vehicle_newest">{t("directory.sortVehicleNew")}</option>
                <option value="town">{t("directory.sortTown")}</option>
              </select>
            </label>

            <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink/50">
                {t("directory.town")}
              </span>
              <select
                value={town}
                onChange={(e) => setTown(e.target.value)}
                className="rounded-md border-2 border-ink bg-paper px-2 py-2 text-sm"
              >
                <option value="">{t("directory.allTowns")}</option>
                {towns.map((tw) => (
                  <option key={tw} value={tw}>
                    {tw}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-ink/80">
              <input
                type="checkbox"
                checked={featuredOnly}
                onChange={(e) => setFeaturedOnly(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              {t("directory.featuredOnly")}
            </label>
          </div>
        </div>

        {isLoading ? (
          <p className="mt-8 text-ink/60">{t("members.loading")}</p>
        ) : members.length === 0 ? (
          <div className="mt-10 rounded-2xl border-2 border-dashed border-ink/30 bg-paper/50 px-6 py-12 text-center">
            <Users className="mx-auto h-8 w-8 text-ink/30" />
            <p className="mt-3 font-display text-xl text-ink/70">{t("directory.empty")}</p>
            <p className="mt-1 text-sm text-ink/50">{t("directory.emptyHint")}</p>
          </div>
        ) : (
          <ul
            className={`mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 ${
              isFetching ? "opacity-70" : ""
            }`}
          >
            {members.map((m) => {
              const carPhoto = m.car_photo_url;
              const facePhoto = pickFacePhoto(m.avatar_url, carPhoto);
              const ride = rideLine(m);
              return (
                <li key={m.user_id}>
                  <Link
                    to="/members/$number"
                    params={{ number: String(m.member_number) }}
                    className="block transition-transform hover:translate-x-0.5 hover:translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                    aria-label={m.display_name ?? `Member #${m.member_number}`}
                  >
                    <MemberCard
                      profile={{
                        display_name: m.display_name,
                        member_number: m.member_number,
                        town: m.town,
                        favourite_ride: ride,
                        joined_at: m.joined_at,
                        membership_status: m.membership_status,
                      }}
                      carPhoto={carPhoto}
                      facePhoto={facePhoto}
                      compact
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </SiteLayout>
  );
}
