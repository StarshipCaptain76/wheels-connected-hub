import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { GarageManager } from "@/components/GarageManager";
import { MemberCard, pickCarPhoto, pickFacePhoto } from "@/components/MemberCard";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMyProfile, type MemberProfile } from "@/lib/profile.functions";
import { getMyRoles } from "@/lib/roles.functions";
import { listMyGarage } from "@/lib/garage.functions";
import { CACHED_PROFILE_KEY } from "@/lib/members-cache";
import { IdCard, LogOut, Shield, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/members/")({
  head: () => ({
    meta: [
      { title: "Members — Just Wheels Hessequa" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(updateMyProfile);
  const fetchRoles = useServerFn(getMyRoles);
  const fetchGarage = useServerFn(listMyGarage);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => fetchProfile(),
  });
  const { data: roles } = useQuery({
    queryKey: ["roles", "me"],
    queryFn: () => fetchRoles(),
  });
  const { data: garage } = useQuery({
    queryKey: ["garage", "me"],
    queryFn: () => fetchGarage(),
  });
  const isAdmin = Boolean(roles?.isAdmin);
  const carPhoto = pickCarPhoto(garage ?? []);
  const facePhoto = pickFacePhoto(profile?.avatar_url ?? null, carPhoto);

  useEffect(() => {
    if (profile && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(profile));
      } catch {
        /* ignore */
      }
      if (profile.preferred_lang === "en" || profile.preferred_lang === "af") {
        setLang(profile.preferred_lang);
      }
    }
  }, [profile, setLang]);

  const [form, setForm] = useState({
    display_name: "",
    phone: "",
    town: "",
    favourite_ride: "",
    featured_bio: "",
    preferred_lang: "en" as "en" | "af",
    directory_visible: true,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        phone: profile.phone ?? "",
        town: profile.town ?? "",
        favourite_ride: profile.favourite_ride ?? "",
        featured_bio: profile.featured_bio ?? "",
        preferred_lang: profile.preferred_lang === "af" ? "af" : "en",
        directory_visible: profile.directory_visible !== false,
      });
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      saveProfile({
        data: {
          display_name: data.display_name || null,
          phone: data.phone || null,
          town: data.town || null,
          favourite_ride: data.favourite_ride || null,
          featured_bio: data.featured_bio || null,
          preferred_lang: data.preferred_lang,
          directory_visible: data.directory_visible,
        },
      }),
    onSuccess: (updated) => {
      qc.setQueryData(["profile", "me"], updated);
      if (updated.preferred_lang === "en" || updated.preferred_lang === "af") {
        setLang(updated.preferred_lang);
      }
      void qc.invalidateQueries({ queryKey: ["directory"] });
    },
  });

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    try {
      window.localStorage.removeItem(CACHED_PROFILE_KEY);
    } catch {
      /* ignore */
    }
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-xs tracking-[0.3em] text-primary">
              {t("members.kicker")}
            </p>
            <h1 className="font-display text-4xl tracking-wide text-ink sm:text-5xl">
              {t("members.title")}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/members/directory"
              className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-paper px-4 py-2 text-sm font-bold uppercase tracking-wider text-ink shadow-[3px_3px_0_0_var(--color-primary)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
            >
              <Users className="h-4 w-4 text-primary" /> {t("directory.browse")}
            </Link>
            <Link
              to="/members/card"
              className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
            >
              <IdCard className="h-4 w-4" /> {t("members.viewCard")}
            </Link>
            {mySponsor && (
              <Link
                to="/members/sponsor"
                className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-paper px-4 py-2 text-sm font-bold uppercase tracking-wider text-ink shadow-[3px_3px_0_0_var(--color-primary)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
              >
                <Handshake className="h-4 w-4 text-primary" /> My sponsor card
              </Link>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm font-bold uppercase tracking-wider text-ink hover:bg-ink/5"
            >
              <LogOut className="h-4 w-4" /> {t("auth.signOut")}
            </button>
          </div>
        </div>

        {/* Admin portal — top of page, above profile / garage */}
        {isAdmin && (
          <div className="mt-6 rounded-2xl border-2 border-ink bg-ink p-5 text-paper shadow-[4px_4px_0_0_var(--color-primary)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <p className="font-display text-xs tracking-[0.3em] text-primary">ADMIN</p>
                </div>
                <h2 className="mt-1 font-display text-2xl tracking-wide">Club admin portal</h2>
                <p className="mt-1 text-sm text-paper/70">
                  Manage events, gallery, members, featured member, classifieds, shop, sponsors and
                  newsletter.
                </p>
              </div>
              <Link
                to="/admin"
                className="inline-flex shrink-0 items-center gap-2 rounded-md border-2 border-primary bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-paper hover:bg-paper hover:text-primary"
              >
                Open admin portal
              </Link>
            </div>
          </div>
        )}

        {isLoading || !profile ? (
          <p className="mt-8 text-ink/60">{t("members.loading")}</p>
        ) : (
          <>
            <div className="mt-8 grid gap-6 md:grid-cols-[1fr_320px]">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  mutation.mutate(form);
                }}
                className="space-y-4 rounded-2xl border-2 border-ink bg-paper p-6 shadow-[4px_4px_0_0_var(--color-ink)]"
              >
                <h2 className="font-display text-2xl tracking-wide text-ink">
                  {t("members.profile")}
                </h2>

                <ProfileField
                  label={t("members.displayName")}
                  value={form.display_name}
                  onChange={(v) => setForm((f) => ({ ...f, display_name: v }))}
                />
                <ProfileField
                  label={t("members.phone")}
                  value={form.phone}
                  onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                />
                <ProfileField
                  label={t("members.town")}
                  value={form.town}
                  onChange={(v) => setForm((f) => ({ ...f, town: v }))}
                />
                <ProfileField
                  label={t("members.favouriteRide")}
                  value={form.favourite_ride}
                  onChange={(v) => setForm((f) => ({ ...f, favourite_ride: v }))}
                />

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink/70">
                    {lang === "af" ? "My storie / bio" : "My bio"}
                  </label>
                  <textarea
                    rows={5}
                    maxLength={600}
                    value={form.featured_bio}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, featured_bio: e.target.value.slice(0, 600) }))
                    }
                    placeholder={
                      lang === "af"
                        ? "Vertel die klub van jou, jou motors en jou stories…"
                        : "Tell the club about you, your cars and your stories…"
                    }
                    className="w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm leading-relaxed"
                  />
                  <p className="mt-1 flex justify-between text-[11px] text-ink/45">
                    <span>
                      {lang === "af"
                        ? "Verskyn op jou lidprofiel en wanneer jy die uitgestalde lid is."
                        : "Shows on your member profile and when you're the featured member."}
                    </span>
                    <span>{form.featured_bio.length}/600</span>
                  </p>
                </div>



                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink/70">
                    {lang === "af" ? "Voorkeurtaal" : "Preferred language"}
                  </label>
                  <div className="inline-flex rounded-full border-2 border-ink bg-paper p-0.5 text-xs font-bold uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, preferred_lang: "en" }))}
                      className={`rounded-full px-3 py-1.5 ${
                        form.preferred_lang === "en" ? "bg-ink text-paper" : "text-ink/60"
                      }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, preferred_lang: "af" }))}
                      className={`rounded-full px-3 py-1.5 ${
                        form.preferred_lang === "af" ? "bg-ink text-paper" : "text-ink/60"
                      }`}
                    >
                      Afrikaans
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-ink/45">
                    {lang === "af"
                      ? "Die app oop en hardloop in hierdie taal vir jou."
                      : "The app opens and runs in this language for you."}
                  </p>
                </div>

                <div className="rounded-xl border-2 border-ink/15 bg-ink/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wider text-ink/70">
                        {t("directory.privacyLabel")}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-ink/50">
                        {t("directory.privacyHint")}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.directory_visible}
                      onClick={() =>
                        setForm((f) => ({ ...f, directory_visible: !f.directory_visible }))
                      }
                      className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-ink transition-colors ${
                        form.directory_visible ? "bg-primary" : "bg-paper"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full border-2 border-ink bg-paper transition-transform ${
                          form.directory_visible ? "left-5" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="rounded-md border-2 border-ink bg-ink px-5 py-2 text-sm font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-primary)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:opacity-50"
                >
                  {mutation.isPending ? "…" : t("members.save")}
                </button>
                {mutation.isSuccess && (
                  <p className="text-sm text-primary">{t("members.saved")}</p>
                )}
                {mutation.isError && (
                  <p className="text-sm text-primary">{t("members.saveError")}</p>
                )}
              </form>

              <aside className="space-y-4">
                <MemberCard
                  profile={profile}
                  carPhoto={carPhoto}
                  facePhoto={facePhoto}
                  compact
                />
                <Link
                  to="/members/card"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border-2 border-ink bg-paper px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink hover:bg-ink/5"
                >
                  <IdCard className="h-4 w-4" /> {t("members.viewCard")}
                </Link>
                <Link
                  to="/members/directory"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border-2 border-ink bg-paper px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink hover:bg-ink/5"
                >
                  <Users className="h-4 w-4 text-primary" /> {t("directory.browse")}
                </Link>
                <div className="rounded-2xl border-2 border-ink bg-ink p-5 text-paper shadow-[4px_4px_0_0_var(--color-primary)]">
                  <p className="font-display text-xs tracking-[0.3em] text-primary">
                    {t("members.summary")}
                  </p>
                  <dl className="mt-3 space-y-2 text-sm">
                    <SummaryRow label={t("members.status")} value={profile.membership_status} />
                    <SummaryRow label={t("members.email")} value={profile.email ?? "—"} />
                    <SummaryRow
                      label={t("members.joined")}
                      value={new Date(profile.joined_at).toLocaleDateString()}
                    />
                  </dl>
                </div>
              </aside>
            </div>

            <GarageManager avatarUrl={profile.avatar_url} lang={lang} />
          </>
        )}
      </section>
    </SiteLayout>
  );
}

function ProfileField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink/70">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-paper/10 py-1 last:border-0">
      <dt className="text-xs uppercase tracking-widest text-paper/60">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

export type { MemberProfile };
