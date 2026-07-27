import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMyProfile, type MemberProfile } from "@/lib/profile.functions";
import { getMyRoles } from "@/lib/roles.functions";
import { CACHED_PROFILE_KEY } from "@/lib/members-cache";
import { IdCard, LogOut, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({
    meta: [
      { title: "Members — Just Wheels Hessequa" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(updateMyProfile);
  const fetchRoles = useServerFn(getMyRoles);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => fetchProfile(),
  });
  const { data: roles } = useQuery({
    queryKey: ["roles", "me"],
    queryFn: () => fetchRoles(),
  });
  const isAdmin = Boolean(roles?.isAdmin);

  // Cache profile locally so /members/card works offline.
  useEffect(() => {
    if (profile && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(profile));
      } catch {}
    }
  }, [profile]);

  const [form, setForm] = useState({
    display_name: "",
    phone: "",
    town: "",
    favourite_ride: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        phone: profile.phone ?? "",
        town: profile.town ?? "",
        favourite_ride: profile.favourite_ride ?? "",
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
        },
      }),
    onSuccess: (updated) => {
      qc.setQueryData(["profile", "me"], updated);
    },
  });

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    try {
      window.localStorage.removeItem(CACHED_PROFILE_KEY);
    } catch {}
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
          <div className="flex gap-2">
            <Link
              to="/members/card"
              className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
            >
              <IdCard className="h-4 w-4" /> {t("members.viewCard")}
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm font-bold uppercase tracking-wider text-ink hover:bg-ink/5"
            >
              <LogOut className="h-4 w-4" /> {t("auth.signOut")}
            </button>
          </div>
        </div>

        {isLoading || !profile ? (
          <p className="mt-8 text-ink/60">{t("members.loading")}</p>
        ) : (
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

            <aside className="rounded-2xl border-2 border-ink bg-ink p-5 text-paper shadow-[4px_4px_0_0_var(--color-primary)]">
              <p className="font-display text-xs tracking-[0.3em] text-primary">
                {t("members.summary")}
              </p>
              <div className="mt-2 font-display text-3xl leading-none">
                #{String(profile.member_number).padStart(4, "0")}
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <SummaryRow label={t("members.status")} value={profile.membership_status} />
                <SummaryRow
                  label={t("members.email")}
                  value={profile.email ?? "—"}
                />
                <SummaryRow
                  label={t("members.joined")}
                  value={new Date(profile.joined_at).toLocaleDateString()}
                />
              </dl>
            </aside>
          </div>
        )}

        {isAdmin && (
          <div className="mt-8 rounded-2xl border-2 border-ink bg-ink p-6 text-paper shadow-[4px_4px_0_0_var(--color-primary)]">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <p className="font-display text-xs tracking-[0.3em] text-primary">ADMIN</p>
            </div>
            <h2 className="mt-1 font-display text-2xl tracking-wide">Club admin portal</h2>
            <p className="mt-1 text-sm text-paper/70">
              Manage events, gallery, members, featured member, classifieds, shop, sponsors and newsletter.
            </p>
            <Link
              to="/admin"
              className="mt-4 inline-flex items-center gap-2 rounded-md border-2 border-primary bg-primary px-5 py-2 text-sm font-bold uppercase tracking-wider text-paper hover:bg-paper hover:text-primary"
            >
              Open admin portal
            </Link>
          </div>
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
