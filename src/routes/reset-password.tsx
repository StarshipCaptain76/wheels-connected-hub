import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — Just Wheels Hessequa" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    // Supabase recovery links open here with a session already established
    // (either via URL hash tokens or a code exchange handled by the client).
    // We just need to confirm a session exists before allowing an update.
    let mounted = true;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setReady(data.session ? "ok" : "invalid");
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady("ok");
      }
    });

    void check();
    // Give Supabase a moment to hydrate the recovery session from the URL.
    const timeout = setTimeout(() => {
      if (mounted && ready === "checking") void check();
    }, 800);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setInfo(t("auth.passwordUpdated"));
      setTimeout(() => navigate({ to: "/members", replace: true }), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border-2 border-ink bg-paper p-6 shadow-[6px_6px_0_0_var(--color-ink)]">
          <h1 className="font-display text-4xl tracking-wide text-ink">{t("auth.resetTitle")}</h1>
          <p className="mt-1 text-sm text-ink/70">{t("auth.resetSubtitle")}</p>

          {ready === "invalid" ? (
            <div className="mt-6 space-y-4">
              <p className="rounded-md border-2 border-primary bg-primary/10 px-3 py-2 text-sm text-primary">
                {t("auth.resetInvalid")}
              </p>
              <Link
                to="/auth"
                className="inline-block rounded-md border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper"
              >
                {t("auth.backToSignIn")}
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink/70">
                  {t("auth.newPassword")}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
                  autoComplete="new-password"
                  disabled={ready !== "ok"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink/70">
                  {t("auth.confirmPassword")}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
                  autoComplete="new-password"
                  disabled={ready !== "ok"}
                />
              </div>

              {error && (
                <p className="rounded-md border-2 border-primary bg-primary/10 px-3 py-2 text-sm text-primary">
                  {error}
                </p>
              )}
              {info && (
                <p className="rounded-md border-2 border-ink/20 bg-ink/5 px-3 py-2 text-sm text-ink">
                  {info}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || ready !== "ok"}
                className="w-full rounded-md border-2 border-ink bg-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:opacity-60"
              >
                {loading ? "…" : t("auth.updatePassword")}
              </button>
            </form>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
