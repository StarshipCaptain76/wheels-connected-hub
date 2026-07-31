import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { Eye, EyeOff, Mail } from "lucide-react";

function safePath(value: unknown): string {
  if (typeof value !== "string") return "/members";
  if (!value.startsWith("/") || value.startsWith("//")) return "/members";
  return value;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safePath(search.redirect),
    mode: search.mode === "signup" ? ("signup" as const) : undefined,
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
  const search = Route.useSearch();
  const redirectTo = search.redirect;
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(
    search.mode === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [awaitingEmail, setAwaitingEmail] = useState(false);

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
        setAwaitingEmail(true);
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setInfo(t("auth.resetSent"));
        setAwaitingEmail(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: redirectTo, replace: true });
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
        redirect_uri: `${window.location.origin}/auth?redirect=${encodeURIComponent(redirectTo)}`,
      });
      if (result.error) throw result.error;
      if (!result.redirected) navigate({ to: redirectTo, replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  function backToSignIn() {
    setError(null);
    setInfo(null);
    setAwaitingEmail(false);
    setMode("signin");
  }

  const inputClass =
    "w-full rounded-md border-2 border-ink bg-paper px-3 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <SiteLayout>
      <section className="mx-auto max-w-md px-4 py-12 sm:py-16">
        <div className="rounded-2xl border-2 border-ink bg-paper p-6 shadow-[6px_6px_0_0_var(--color-ink)] sm:p-8">
          {awaitingEmail ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-primary">
                <Mail className="h-8 w-8" />
              </div>
              <h1 className="font-display text-3xl tracking-wide text-ink sm:text-4xl">
                {mode === "forgot" ? t("auth.resetSent") : t("auth.checkEmail")}
              </h1>
              <p className="mt-4 text-base leading-relaxed text-ink/80">
                {email
                  ? mode === "forgot"
                    ? `We sent a reset link to ${email}. Open that email, set a new password, then come back here to sign in.`
                    : `We sent a confirmation link to ${email}. Open that email and tap the link to activate your account, then sign in.`
                  : info}
              </p>
              <button
                type="button"
                onClick={backToSignIn}
                className="mt-8 w-full rounded-md border-2 border-ink bg-primary px-4 py-3.5 text-base font-bold text-white shadow-[3px_3px_0_0_var(--color-ink)]"
              >
                {t("auth.backToSignIn")}
              </button>
              <p className="mt-4 text-sm text-ink/50">
                Didn't get it? Check spam, or try again in a few minutes.
              </p>
            </div>
          ) : mode === "forgot" ? (
            <>
              <h1 className="font-display text-3xl tracking-wide text-ink sm:text-4xl">
                {t("auth.forgotTitle")}
              </h1>
              <p className="mt-2 text-base text-ink/70">{t("auth.forgotSubtitle")}</p>
              <form onSubmit={handleEmail} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-ink/80">{t("auth.email")}</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    autoComplete="email"
                  />
                </div>
                {error && (
                  <p className="rounded-md border-2 border-primary bg-primary/10 px-3 py-2 text-base text-primary">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md border-2 border-ink bg-primary px-4 py-3.5 text-base font-bold text-white shadow-[3px_3px_0_0_var(--color-ink)] disabled:opacity-60"
                >
                  {loading ? "…" : t("auth.sendReset")}
                </button>
              </form>
              <p className="mt-5 text-center text-base">
                <button type="button" className="font-bold text-primary underline" onClick={backToSignIn}>
                  {t("auth.backToSignIn")}
                </button>
              </p>
            </>
          ) : (
            <>
              {/* Big tabs */}
              <div className="grid grid-cols-2 gap-1 rounded-xl border-2 border-ink bg-ink/5 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                  className={`rounded-lg px-3 py-3 text-base font-bold transition ${
                    mode === "signin" ? "bg-ink text-paper" : "text-ink/60 hover:text-ink"
                  }`}
                >
                  {t("auth.tabSignIn")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                  className={`rounded-lg px-3 py-3 text-base font-bold transition ${
                    mode === "signup" ? "bg-ink text-paper" : "text-ink/60 hover:text-ink"
                  }`}
                >
                  {t("auth.tabSignUp")}
                </button>
              </div>

              <h1 className="mt-6 font-display text-3xl tracking-wide text-ink sm:text-4xl">
                {mode === "signin" ? t("auth.signInTitle") : t("auth.signUpTitle")}
              </h1>
              <p className="mt-1 text-base text-ink/70">
                {mode === "signin" ? t("auth.signInSubtitle") : t("auth.signUpSubtitle")}
              </p>

              {/* Google first */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="mt-6 flex w-full items-center justify-center gap-3 rounded-md border-2 border-ink bg-paper px-4 py-3.5 text-base font-bold text-ink shadow-[3px_3px_0_0_var(--color-ink)] disabled:opacity-50"
              >
                <GoogleIcon /> {t("auth.google")}
              </button>

              <div className="my-5 flex items-center gap-3 text-sm uppercase tracking-widest text-ink/50">
                <span className="h-px flex-1 bg-ink/20" />
                <span>{t("auth.or")}</span>
                <span className="h-px flex-1 bg-ink/20" />
              </div>

              <form onSubmit={handleEmail} className="space-y-4">
                {mode === "signup" && (
                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-ink/80">
                      {t("auth.displayName")}
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className={inputClass}
                      autoComplete="name"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-ink/80">{t("auth.email")}</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    autoComplete="email"
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="text-sm font-bold text-ink/80">{t("auth.password")}</label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setMode("forgot");
                        }}
                        className="text-sm font-bold text-primary underline"
                      >
                        {t("auth.forgotLink")}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass} pr-24`}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded px-2 py-1 text-sm font-semibold text-ink/60 hover:text-ink"
                    >
                      {showPassword ? (
                        <>
                          <EyeOff className="h-4 w-4" /> {t("auth.hidePassword")}
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4" /> {t("auth.showPassword")}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="rounded-md border-2 border-primary bg-primary/10 px-3 py-2 text-base text-primary">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md border-2 border-ink bg-primary px-4 py-3.5 text-base font-bold text-white shadow-[3px_3px_0_0_var(--color-ink)] disabled:opacity-60"
                >
                  {loading ? "…" : mode === "signin" ? t("auth.signIn") : t("auth.signUp")}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-ink/50">
                <Link to="/join" className="hover:text-ink hover:underline">
                  {t("auth.learnMore")}
                </Link>
              </p>
            </>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.75 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.26 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.2 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
