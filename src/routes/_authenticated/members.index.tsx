import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { GarageManager } from "@/components/GarageManager";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMyProfile, type MemberProfile } from "@/lib/profile.functions";
import { getMyRoles } from "@/lib/roles.functions";
import { CACHED_PROFILE_KEY } from "@/lib/members-cache";
import { Car, IdCard, LogOut, Shield, UserRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/members/")({
  head: () => ({
    meta: [
      { title: "Members — Just Wheels Hessequa" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MembersPage,
});

type Panel = "hub" | "profile" | "garage";

function MembersPage() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(updateMyProfile);
  const fetchRoles = useServerFn(getMyRoles);
  const setupStarted = useRef(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => fetchProfile(),
  });
  const { data: roles } = useQuery({
    queryKey: ["roles", "me"],
    queryFn: () => fetchRoles(),
  });
  const isAdmin = Boolean(roles?.isAdmin);

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

  const incomplete = Boolean(
    profile && (!profile.display_name?.trim() || !profile.phone?.trim()),
  );

  const [panel, setPanel] = useState<Panel>("hub");
  const [setupStep, setSetupStep] = useState(0); // 0 = not in wizard, 1-2 = steps
  const [form, setForm] = useState({
    display_name: "",
    phone: "",
    town: "",
    favourite_ride: "",
    preferred_lang: "en" as "en" | "af",
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      display_name: profile.display_name ?? "",
      phone: profile.phone ?? "",
      town: profile.town ?? "",
      favourite_ride: profile.favourite_ride ?? "",
      preferred_lang: profile.preferred_lang === "af" ? "af" : "en",
    });
    if (incomplete && !setupStarted.current) {
      setupStarted.current = true;
      setSetupStep(1);
    }
  }, [profile, incomplete]);

  const inWizard = setupStep === 1 || setupStep === 2;

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      saveProfile({
        data: {
          display_name: data.display_name || null,
          phone: data.phone || null,
          town: data.town || null,
          favourite_ride: data.favourite_ride || null,
          preferred_lang: data.preferred_lang,
        },
      }),
    onSuccess: (updated) => {
      qc.setQueryData(["profile", "me"], updated);
      if (updated.preferred_lang === "en" || updated.preferred_lang === "af") {
        setLang(updated.preferred_lang);
      }
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

  const inputClass =
    "w-full rounded-md border-2 border-ink bg-paper px-3 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-xs tracking-[0.3em] text-primary">{t("members.kicker")}</p>
            <h1 className="font-display text-4xl tracking-wide text-ink sm:text-5xl">
              {t("members.title")}
            </h1>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border-2 border-ink bg-paper px-4 py-2 text-base font-bold text-ink hover:bg-ink/5"
          >
            <LogOut className="h-4 w-4" /> {t("auth.signOut")}
          </button>
        </div>

        {isAdmin && (
          <div className="mt-6 rounded-2xl border-2 border-ink bg-ink p-5 text-paper shadow-[4px_4px_0_0_var(--color-primary)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <p className="font-display text-xs tracking-[0.3em] text-primary">ADMIN</p>
                </div>
                <h2 className="mt-1 font-display text-2xl tracking-wide">Club admin portal</h2>
                <p className="mt-1 text-base text-paper/70">
                  Manage events, gallery, members, classifieds, shop, sponsors and newsletter.
                </p>
              </div>
              <Link
                to="/admin"
                className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-md border-2 border-primary bg-primary px-5 py-3 text-base font-bold text-paper hover:bg-paper hover:text-primary"
              >
                Open admin portal
              </Link>
            </div>
          </div>
        )}

        {isLoading || !profile ? (
          <p className="mt-8 text-lg text-ink/60">{t("members.loading")}</p>
        ) : inWizard ? (
          <div className="mt-8 rounded-2xl border-2 border-ink bg-paper p-6 shadow-[4px_4px_0_0_var(--color-ink)] sm:p-8">
            <p className="text-sm font-bold uppercase tracking-wider text-primary">
              {t("members.setupStep")} {setupStep} / 2
            </p>
            <h2 className="mt-1 font-display text-3xl text-ink">{t("members.setupTitle")}</h2>

            {setupStep === 1 && (
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  mutation.mutate(form, {
                    onSuccess: () => setSetupStep(2),
                  });
                }}
              >
                <p className="text-base text-ink/70">
                  {lang === "af"
                    ? "Jou naam en foon help ander lede jou vind."
                    : "Your name and phone help other members find you."}
                </p>
                <ProfileField
                  label={t("members.displayName")}
                  value={form.display_name}
                  onChange={(v) => setForm((f) => ({ ...f, display_name: v }))}
                  required
                  className={inputClass}
                />
                <ProfileField
                  label={t("members.phone")}
                  value={form.phone}
                  onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                  required
                  className={inputClass}
                />
                <ProfileField
                  label={t("members.town")}
                  value={form.town}
                  onChange={(v) => setForm((f) => ({ ...f, town: v }))}
                  className={inputClass}
                />
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-ink/80">
                    {lang === "af" ? "Voorkeurtaal" : "Preferred language"}
                  </label>
                  <div className="inline-flex rounded-full border-2 border-ink bg-paper p-0.5 text-sm font-bold">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, preferred_lang: "en" }))}
                      className={`min-h-10 rounded-full px-4 py-2 ${form.preferred_lang === "en" ? "bg-ink text-paper" : "text-ink/60"}`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, preferred_lang: "af" }))}
                      className={`min-h-10 rounded-full px-4 py-2 ${form.preferred_lang === "af" ? "bg-ink text-paper" : "text-ink/60"}`}
                    >
                      Afrikaans
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={mutation.isPending || !form.display_name.trim() || !form.phone.trim()}
                  className="w-full rounded-md border-2 border-ink bg-primary px-5 py-3.5 text-base font-bold text-white shadow-[3px_3px_0_0_var(--color-ink)] disabled:opacity-50 sm:w-auto"
                >
                  {mutation.isPending ? "…" : t("members.setupNext")}
                </button>
                {mutation.isError && (
                  <p className="text-base text-primary">{t("members.saveError")}</p>
                )}
              </form>
            )}

            {setupStep === 2 && (
              <div className="mt-6">
                <p className="text-base text-ink/70">
                  {lang === "af"
                    ? "Voeg jou eerste voertuig by (opsioneel), of gaan reguit na jou lidkaart."
                    : "Add your first vehicle (optional), or go straight to your member card."}
                </p>
                <div className="mt-4">
                  <GarageManager avatarUrl={profile.avatar_url} lang={lang} />
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to="/members/card"
                    className="inline-flex min-h-12 items-center rounded-md border-2 border-ink bg-primary px-5 py-3 text-base font-bold text-white"
                  >
                    {t("members.setupDone")} — {t("members.hubCard")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setSetupStep(0);
                      setPanel("hub");
                    }}
                    className="inline-flex min-h-12 items-center rounded-md border-2 border-ink bg-paper px-5 py-3 text-base font-bold text-ink"
                  >
                    {lang === "af" ? "Na klub tuiste" : "Go to club home"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {panel === "hub" && (
              <div className="mt-8">
                <h2 className="font-display text-2xl text-ink">{t("members.hubTitle")}</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <HubCard
                    icon={<UserRound className="h-7 w-7" />}
                    title={t("members.hubProfile")}
                    hint={t("members.hubProfileHint")}
                    onClick={() => setPanel("profile")}
                  />
                  <HubCard
                    icon={<Car className="h-7 w-7" />}
                    title={t("members.hubGarage")}
                    hint={t("members.hubGarageHint")}
                    onClick={() => setPanel("garage")}
                  />
                  <Link
                    to="/members/card"
                    className="flex flex-col rounded-2xl border-2 border-ink bg-card p-5 shadow-[4px_4px_0_0_var(--color-ink)] transition hover:-translate-y-0.5"
                  >
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink bg-primary text-paper">
                      <IdCard className="h-7 w-7" />
                    </span>
                    <span className="mt-4 font-display text-2xl text-ink">{t("members.hubCard")}</span>
                    <span className="mt-1 text-base text-ink/65">{t("members.hubCardHint")}</span>
                  </Link>
                </div>

                <aside className="mt-8 rounded-2xl border-2 border-ink bg-ink p-5 text-paper">
                  {profile.avatar_url && (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="mb-3 h-16 w-16 rounded-full border-2 border-paper object-cover"
                    />
                  )}
                  <p className="font-display text-xs tracking-[0.3em] text-primary">
                    {t("members.summary")}
                  </p>
                  <div className="mt-1 font-display text-3xl">
                    #{String(profile.member_number).padStart(4, "0")}
                  </div>
                  <p className="mt-2 text-base text-paper/80">
                    {profile.display_name ?? "—"}
                    {profile.town ? ` · ${profile.town}` : ""}
                  </p>
                </aside>
              </div>
            )}

            {panel === "profile" && (
              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => setPanel("hub")}
                  className="text-base font-semibold text-ink/70 hover:text-ink"
                >
                  ← {t("members.back")}
                </button>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    mutation.mutate(form);
                  }}
                  className="mt-4 space-y-4 rounded-2xl border-2 border-ink bg-paper p-6 shadow-[4px_4px_0_0_var(--color-ink)]"
                >
                  <h2 className="font-display text-2xl tracking-wide text-ink">{t("members.profile")}</h2>
                  <ProfileField
                    label={t("members.displayName")}
                    value={form.display_name}
                    onChange={(v) => setForm((f) => ({ ...f, display_name: v }))}
                    className={inputClass}
                  />
                  <ProfileField
                    label={t("members.phone")}
                    value={form.phone}
                    onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                    className={inputClass}
                  />
                  <ProfileField
                    label={t("members.town")}
                    value={form.town}
                    onChange={(v) => setForm((f) => ({ ...f, town: v }))}
                    className={inputClass}
                  />
                  <ProfileField
                    label={t("members.favouriteRide")}
                    value={form.favourite_ride}
                    onChange={(v) => setForm((f) => ({ ...f, favourite_ride: v }))}
                    className={inputClass}
                  />
                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-ink/80">
                      {lang === "af" ? "Voorkeurtaal" : "Preferred language"}
                    </label>
                    <div className="inline-flex rounded-full border-2 border-ink bg-paper p-0.5 text-sm font-bold">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, preferred_lang: "en" }))}
                        className={`min-h-10 rounded-full px-4 py-2 ${form.preferred_lang === "en" ? "bg-ink text-paper" : "text-ink/60"}`}
                      >
                        English
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, preferred_lang: "af" }))}
                        className={`min-h-10 rounded-full px-4 py-2 ${form.preferred_lang === "af" ? "bg-ink text-paper" : "text-ink/60"}`}
                      >
                        Afrikaans
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="rounded-md border-2 border-ink bg-ink px-5 py-3 text-base font-bold text-paper shadow-[3px_3px_0_0_var(--color-primary)] disabled:opacity-50"
                  >
                    {mutation.isPending ? "…" : t("members.save")}
                  </button>
                  {mutation.isSuccess && (
                    <p className="text-base text-primary">{t("members.saved")}</p>
                  )}
                  {mutation.isError && (
                    <p className="text-base text-primary">{t("members.saveError")}</p>
                  )}
                </form>
              </div>
            )}

            {panel === "garage" && (
              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => setPanel("hub")}
                  className="text-base font-semibold text-ink/70 hover:text-ink"
                >
                  ← {t("members.back")}
                </button>
                <div className="mt-4">
                  <GarageManager avatarUrl={profile.avatar_url} lang={lang} />
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </SiteLayout>
  );
}

function HubCard({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-2xl border-2 border-ink bg-card p-5 text-left shadow-[4px_4px_0_0_var(--color-ink)] transition hover:-translate-y-0.5"
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink bg-primary text-paper">
        {icon}
      </span>
      <span className="mt-4 font-display text-2xl text-ink">{title}</span>
      <span className="mt-1 text-base text-ink/65">{hint}</span>
    </button>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  required,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  className?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-bold text-ink/80">
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </label>
      <input
        type="text"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          className ??
          "w-full rounded-md border-2 border-ink bg-paper px-3 py-3 text-base text-ink"
        }
      />
    </div>
  );
}

export type { MemberProfile };
