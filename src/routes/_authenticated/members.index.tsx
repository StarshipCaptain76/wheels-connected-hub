import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { GarageManager } from "@/components/GarageManager";
import { TaggedPhotos } from "@/components/TaggedPhotos";
import { ChangePassword } from "@/components/ChangePassword";
import { NotificationSettings } from "@/components/NotificationSettings";
import { ProfileCompletionBanner } from "@/components/ProfileCompletionBanner";
import { ProfileWizard } from "@/components/ProfileWizard";
import { missingProfileFields } from "@/lib/profile-completeness";

import { MemberCard, pickCarPhoto, pickFacePhoto } from "@/components/MemberCard";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMyProfile, type MemberProfile } from "@/lib/profile.functions";
import { getMyRoles } from "@/lib/roles.functions";
import { listMyGarage } from "@/lib/garage.functions";
import { CACHED_PROFILE_KEY } from "@/lib/members-cache";
import { getMySponsor } from "@/lib/sponsors.functions";
import { Handshake, IdCard, LogOut, Shield, Users } from "lucide-react";


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
  const fetchMySponsor = useServerFn(getMySponsor);
  const { data: mySponsor } = useQuery({
    queryKey: ["sponsor", "mine"],
    queryFn: () => fetchMySponsor(),
  });
  const isAdmin = Boolean(roles?.isAdmin);

  const carPhoto = pickCarPhoto(garage ?? []);
  const facePhoto = pickFacePhoto(profile?.avatar_url ?? null, carPhoto);

  const missingFields = missingProfileFields(profile);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Auto-open the wizard once per browser session while the profile is incomplete.
  useEffect(() => {
    if (!profile || missingFields.length === 0) return;
    if (typeof window === "undefined") return;
    const flag = "jw-profile-wizard-seen";
    try {
      if (window.sessionStorage.getItem(flag)) return;
      window.sessionStorage.setItem(flag, "1");
    } catch {
      /* ignore */
    }
    setWizardOpen(true);
  }, [profile, missingFields.length]);

  useEffect(() => {
    function applyHash() {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      if (hash === "#profile") {
        setProfileOpen(true);
        requestAnimationFrame(() =>
          document.getElementById("profile")?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
      }
      if (hash === "#photos") {
        setPhotosOpen(true);
        requestAnimationFrame(() =>
          document.getElementById("photos")?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
      }
    }
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);



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

  const chip =
    "inline-flex shrink-0 items-center rounded-full border-2 border-ink bg-paper px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink";

  return (
    <section className="mx-auto max-w-4xl px-3 py-4 sm:px-4 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-display text-[10px] tracking-[0.3em] text-primary">
              {t("members.kicker")}
            </p>
            <h1 className="font-display text-2xl tracking-wide text-ink sm:text-4xl">
              {profile?.display_name || t("members.title")}
            </h1>
            {profile && (
              <p className="text-xs text-ink/55">
                #{String(profile.member_number).padStart(4, "0")} · {profile.membership_status}
              </p>
            )}
          </div>
          <div className="hidden flex-wrap gap-2 sm:flex">
            <Link to="/members/directory" className={chip}>
              <Users className="mr-1 h-3.5 w-3.5 text-primary" /> {t("directory.browse")}
            </Link>
            <Link to="/members/card" className={`${chip} bg-primary text-paper`}>
              <IdCard className="mr-1 h-3.5 w-3.5" /> {t("members.viewCard")}
            </Link>
            {mySponsor && (
              <Link to="/members/sponsor" className={chip}>
                <Handshake className="mr-1 h-3.5 w-3.5 text-primary" /> Sponsor
              </Link>
            )}
            <button type="button" onClick={handleSignOut} className={chip}>
              <LogOut className="mr-1 h-3.5 w-3.5" /> {t("auth.signOut")}
            </button>
          </div>
        </div>

        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:hidden" aria-label="Members shortcuts">
          <a href="#garage" className={`${chip} bg-primary text-paper`}>
            {t("portal.garage")}
          </a>
          <Link to="/members/card" className={chip}>
            {t("portal.card")}
          </Link>
          <a href="#profile" className={chip} onClick={() => setProfileOpen(true)}>
            {t("portal.profile")}
          </a>
          <Link to="/members/directory" className={chip}>
            {t("portal.directory")}
          </Link>
        </nav>

        {profile && (
          <ProfileCompletionBanner
            missing={missingFields}
            onOpen={() => setWizardOpen(true)}
          />
        )}

        {wizardOpen && profile && (
          <ProfileWizard profile={profile} onClose={() => setWizardOpen(false)} />
        )}

        {isAdmin && (
          <Link
            to="/admin"
            className="mt-3 flex items-center justify-between gap-3 rounded-lg border-2 border-ink bg-ink px-3 py-2 text-paper"
          >
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <Shield className="h-3.5 w-3.5 text-primary" /> {t("portal.admin")}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Open →</span>
          </Link>
        )}

        {isLoading || !profile ? (
          <p className="mt-6 text-ink/60">{t("members.loading")}</p>
        ) : (
          <>
            <div className="mt-4 hidden md:block">
              <MemberCard
                profile={profile}
                carPhoto={carPhoto}
                facePhoto={facePhoto}
                compact
              />
            </div>

            <div className="mt-4">
              <GarageManager avatarUrl={profile.avatar_url} lang={lang} />
            </div>

            <details
              id="profile"
              open={profileOpen}
              onToggle={(e) => setProfileOpen((e.target as HTMLDetailsElement).open)}
              className="mt-4 scroll-mt-20 rounded-xl border-2 border-ink bg-paper p-3 shadow-[3px_3px_0_0_var(--color-ink)] sm:p-4"
            >
              <summary className="cursor-pointer list-none font-display text-xl tracking-wide text-ink">
                {t("members.profile")}
              </summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  mutation.mutate(form);
                }}
                className="mt-3 space-y-3"
              >

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
            </details>

            <details
              id="photos"
              open={photosOpen}
              onToggle={(e) => setPhotosOpen((e.target as HTMLDetailsElement).open)}
              className="mt-3 scroll-mt-20 rounded-xl border-2 border-ink bg-paper p-3 shadow-[3px_3px_0_0_var(--color-ink)] sm:p-4"
            >
              <summary className="cursor-pointer list-none font-display text-xl tracking-wide text-ink">
                {t("portal.photos")}
              </summary>
              <div className="mt-3">
                <TaggedPhotos userId={profile.id} canUntag />
              </div>
            </details>

            <details
              open={accountOpen}
              onToggle={(e) => setAccountOpen((e.target as HTMLDetailsElement).open)}
              className="mt-3 rounded-xl border-2 border-ink bg-paper p-3 shadow-[3px_3px_0_0_var(--color-ink)] sm:p-4"
            >
              <summary className="cursor-pointer list-none font-display text-xl tracking-wide text-ink">
                {t("portal.settings")}
              </summary>
              <div className="mt-3 space-y-3">
                <ChangePassword lang={lang === "af" ? "af" : "en"} />
                <NotificationSettings isAdmin={Boolean(roles?.isAdmin)} />
                <div className="rounded-xl border-2 border-ink bg-ink p-4 text-paper">
                  <p className="font-display text-xs tracking-[0.3em] text-primary">
                    {t("members.summary")}
                  </p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <SummaryRow label={t("members.status")} value={profile.membership_status} />
                    <SummaryRow label={t("members.email")} value={profile.email ?? "—"} />
                    <SummaryRow
                      label={t("members.joined")}
                      value={new Date(profile.joined_at).toLocaleDateString()}
                    />
                  </dl>
                </div>
              </div>
            </details>
          </>
        )}
    </section>
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
