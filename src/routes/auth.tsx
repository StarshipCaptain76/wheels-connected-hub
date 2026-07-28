import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";

function safePath(value: unknown): string {
  if (typeof value !== "string") return "/members";
  if (!value.startsWith("/") || value.startsWith("//")) return "/members";
  return value;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safePath(search.redirect),
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Just Wheels Hessequa" },
      { name: "description", content: "Sign in to your Just Wheels Hessequa member account." },
      { property: "og:title", content: "Sign in — Just Wheels Hessequa" },
      { property: "og:description", content: "Members area for Just Wheels Hessequa." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirectTo, replace: true });
    });
  }, [navigate, redirectTo]);


  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        setInfo(t("auth.checkEmail"));
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setInfo(t("auth.resetSent"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/members", replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth`,
      });
      if (result.error) throw result.error;
      if (!result.redirected) navigate({ to: "/members", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }


  return (
    <SiteLayout>
      <section className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border-2 border-ink bg-paper p-6 shadow-[6px_6px_0_0_var(--color-ink)]">
          <h1 className="font-display text-4xl tracking-wide text-ink">
            {mode === "signin"
              ? t("auth.signInTitle")
              : mode === "signup"
                ? t("auth.signUpTitle")
                : t("auth.forgotTitle")}
          </h1>
          <p className="mt-1 text-sm text-ink/70">
            {mode === "signin"
              ? t("auth.signInSubtitle")
              : mode === "signup"
                ? t("auth.signUpSubtitle")
                : t("auth.forgotSubtitle")}
          </p>

          {mode !== "forgot" && (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border-2 border-ink bg-paper px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-ink shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:opacity-50"
              >
                <GoogleIcon /> {t("auth.google")}
              </button>

              <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-ink/50">
                <span className="h-px flex-1 bg-ink/20" />
                <span>{t("auth.or")}</span>
                <span className="h-px flex-1 bg-ink/20" />
              </div>
            </>
          )}

          <form onSubmit={handleEmail} className="mt-6 space-y-3">
            {mode === "signup" && (
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink/70">
                  {t("auth.displayName")}
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
                  autoComplete="name"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink/70">
                {t("auth.email")}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
                autoComplete="email"
              />
            </div>
            {mode !== "forgot" && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink/70">
                    {t("auth.password")}
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setInfo(null);
                        setMode("forgot");
                      }}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      {t("auth.forgotLink")}
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </div>
            )}

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
              disabled={loading}
              className="w-full rounded-md border-2 border-ink bg-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:opacity-60"
            >
              {loading
                ? "…"
                : mode === "signin"
                  ? t("auth.signIn")
                  : mode === "signup"
                    ? t("auth.signUp")
                    : t("auth.sendReset")}
            </button>
          </form>

          {mode === "forgot" ? (
            <p className="mt-5 text-center text-sm text-ink/70">
              <button
                type="button"
                className="font-bold text-primary underline underline-offset-2"
                onClick={() => {
                  setError(null);
                  setInfo(null);
                  setMode("signin");
                }}
              >
                {t("auth.backToSignIn")}
              </button>
            </p>
          ) : (
            <p className="mt-5 text-center text-sm text-ink/70">
              {mode === "signin" ? t("auth.needAccount") : t("auth.haveAccount")}{" "}
              <button
                type="button"
                className="font-bold text-primary underline underline-offset-2"
                onClick={() => {
                  setError(null);
                  setInfo(null);
                  setMode(mode === "signin" ? "signup" : "signin");
                }}
              >
                {mode === "signin" ? t("auth.signUp") : t("auth.signIn")}
              </button>
            </p>
          )}

          <p className="mt-2 text-center text-xs text-ink/50">
            <Link to="/join" className="hover:text-ink">
              {t("auth.learnMore")}
            </Link>
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}


function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.75 3.28-8.09Z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.26 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/>
    </svg>
  );
}
