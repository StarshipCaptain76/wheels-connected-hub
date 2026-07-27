import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { getMemberByNumber, type MemberGarage } from "@/lib/member-lookup.functions";
import { listGarageForUser } from "@/lib/garage.functions";
import { ArrowLeft, Star, Car } from "lucide-react";

const memberQuery = (number: number) =>
  queryOptions({
    queryKey: ["member", number],
    queryFn: async () => {
      const m = await getMemberByNumber({ data: { number } });
      if (!m) throw notFound();
      return m as MemberGarage;
    },
    staleTime: 60_000,
  });

export const Route = createFileRoute("/_authenticated/members/$number")({
  head: () => ({ meta: [{ title: "Member — Just Wheels" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context, params }) => {
    const n = parseInt(params.number, 10);
    if (Number.isNaN(n)) throw notFound();
    return context.queryClient.ensureQueryData(memberQuery(n));
  },
  component: MemberPage,
  notFoundComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl">Member not found</h1>
        <Link to="/members" className="mt-4 inline-block text-primary underline">
          Back to The Garage
        </Link>
      </div>
    </SiteLayout>
  ),
});

function MemberPage() {
  const { number } = Route.useParams();
  const { lang } = useI18n();
  const { data: m } = useSuspenseQuery(memberQuery(parseInt(number, 10)));
  const listGarage = useServerFn(listGarageForUser);
  const { data: vehicles = [] } = useQuery({
    queryKey: ["garage", m.user_id],
    queryFn: () => listGarage({ data: { userId: m.user_id } }),
  });

  return (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/members" className="mb-4 inline-flex items-center gap-2 text-sm text-ink/60 hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> {lang === "af" ? "Terug na Die Garage" : "Back to The Garage"}
        </Link>

        <div className="rounded-lg border-2 border-ink bg-card p-6 shadow-[4px_4px_0_0_var(--color-ink)]">
          <div className="flex items-start gap-4">
            <img
              src={m.featured_photo_url ?? m.avatar_url ?? "/pwa-192.png"}
              alt=""
              className="h-24 w-24 rounded-full border-2 border-ink object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl text-ink">{m.display_name ?? `Member #${m.member_number}`}</h1>
                {m.is_featured && (
                  <span className="inline-flex items-center gap-1 rounded-full border-2 border-primary bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    <Star className="h-3 w-3" /> Featured
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-ink/60">
                #{m.member_number}
                {m.town && ` · ${m.town}`}
              </p>
              {m.favourite_ride && (
                <p className="mt-2 text-ink/80">
                  <span className="font-bold">{lang === "af" ? "Gunsteling rit: " : "Favourite ride: "}</span>
                  {m.favourite_ride}
                </p>
              )}
            </div>
          </div>
          {m.featured_bio && (
            <div className="mt-4 whitespace-pre-wrap border-t-2 border-ink/20 pt-4 text-ink/80">
              {m.featured_bio}
            </div>
          )}
        </div>

        {/* Garage */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
            <Car className="h-5 w-5 text-primary" />
            {lang === "af" ? "Garage" : "Garage"}
          </h2>
          {vehicles.length === 0 ? (
            <p className="mt-2 text-ink/60">
              {lang === "af" ? "Nog geen voertuie bygevoeg nie." : "No vehicles added yet."}
            </p>
          ) : (
            <ul className="mt-4 space-y-6">
              {vehicles.map((v) => {
                const title =
                  v.nickname ||
                  [v.year, v.make, v.model].filter(Boolean).join(" ") ||
                  (lang === "af" ? "Voertuig" : "Vehicle");
                const story = lang === "af" ? v.story_af || v.story : v.story;
                return (
                  <li
                    key={v.id}
                    className="overflow-hidden rounded-2xl border-2 border-ink bg-paper shadow-[4px_4px_0_0_var(--color-ink)]"
                  >
                    {v.photos[0] && (
                      <img
                        src={v.photos[0].url}
                        alt=""
                        className="max-h-72 w-full object-cover border-b-2 border-ink"
                      />
                    )}
                    <div className="p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        {v.is_primary && (
                          <span className="rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                            Primary
                          </span>
                        )}
                        <h3 className="font-display text-2xl text-ink">{title}</h3>
                      </div>
                      {v.nickname && (v.make || v.model) && (
                        <p className="text-sm text-ink/60">
                          {[v.year, v.make, v.model].filter(Boolean).join(" ")}
                        </p>
                      )}
                      {story && (
                        <p className="mt-3 whitespace-pre-wrap text-ink/80">{story}</p>
                      )}
                      {v.photos.length > 1 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {v.photos.slice(1).map((p) => (
                            <img
                              key={p.id}
                              src={p.url}
                              alt={p.caption ?? ""}
                              className="h-20 w-20 rounded border-2 border-ink object-cover"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="font-display text-2xl text-ink">
            {lang === "af" ? "Komende byeenkomste" : "Upcoming events"}
          </h2>
          {m.upcoming.length === 0 ? (
            <p className="mt-2 text-ink/60">{lang === "af" ? "Niks bevestig nie." : "Nothing on the calendar."}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {m.upcoming.map((e) => (
                <li key={e.event_id} className="rounded-lg border-2 border-ink bg-card p-3">
                  <Link
                    to="/events/$id"
                    params={{ id: e.event_id }}
                    className="font-bold text-ink hover:text-primary hover:underline"
                  >
                    {e.title}
                  </Link>
                  <p className="text-xs text-ink/60">
                    {new Date(e.starts_at).toLocaleString(lang === "af" ? "af-ZA" : "en-ZA", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    <span className="font-bold uppercase text-primary">
                      {e.status === "going"
                        ? lang === "af"
                          ? "Ja"
                          : "Going"
                        : lang === "af"
                          ? "Dalk"
                          : "Maybe"}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </SiteLayout>
  );
}
