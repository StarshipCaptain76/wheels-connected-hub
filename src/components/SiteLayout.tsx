import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import logoAsset from "@/assets/justwheels-logo.jpeg.asset.json";
import { Facebook, Instagram, MessageCircle, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="inline-flex items-center rounded-full border-2 border-ink bg-paper p-0.5 text-xs font-bold uppercase tracking-wider">
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`rounded-full px-2.5 py-1 transition-colors ${lang === "en" ? "bg-ink text-paper" : "text-ink/60 hover:text-ink"}`}
        aria-pressed={lang === "en"}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("af")}
        className={`rounded-full px-2.5 py-1 transition-colors ${lang === "af" ? "bg-ink text-paper" : "text-ink/60 hover:text-ink"}`}
        aria-pressed={lang === "af"}
      >
        AF
      </button>
    </div>
  );
}

function AuthAffordance() {
  const { t } = useI18n();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSignedIn(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(Boolean(session));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (signedIn) {
    return (
      <Link
        to="/members"
        className="inline-flex items-center gap-1.5 rounded-md border-2 border-ink bg-ink px-3 py-2 text-xs font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-primary)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none sm:text-sm"
      >
        <UserRound className="h-4 w-4" /> {t("nav.members")}
      </Link>
    );
  }
  return (
    <Link
      to="/auth"
      className="inline-flex items-center rounded-md border-2 border-ink bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none sm:text-sm"
    >
      {t("nav.signIn")}
    </Link>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const navItems = [
    { to: "/", label: t("nav.home") },
    { to: "/events", label: t("nav.events") },
    { to: "/gallery", label: t("nav.gallery") },
    { to: "/classifieds", label: t("nav.classifieds") },
    { to: "/shop", label: t("nav.shop") },
    { to: "/about", label: t("nav.about") },
    { to: "/join", label: t("nav.join") },
    { to: "/contact", label: t("nav.contact") },
  ] as const;


  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b-2 border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={logoAsset.url}
              alt="Just Wheels Hessequa logo"
              className="h-11 w-11 rounded-full border-2 border-ink object-cover"
            />
            <div className="hidden leading-tight sm:block">
              <div className="font-display text-xl tracking-wide text-ink">JUST WHEELS</div>
              <div className="-mt-1 font-display text-xs tracking-[0.25em] text-primary">HESSEQUA</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wider text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
                activeProps={{ className: "text-primary" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LangToggle />
            <AuthAffordance />
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="flex items-center justify-around border-t-2 border-ink/10 px-2 py-1 md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-ink/70"
              activeProps={{ className: "text-primary" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 border-t-2 border-ink bg-ink text-paper">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <img
                src={logoAsset.url}
                alt=""
                className="h-12 w-12 rounded-full border-2 border-paper object-cover"
              />
              <div className="font-display text-2xl leading-none">
                JUST WHEELS
                <div className="text-xs tracking-[0.25em] text-primary">HESSEQUA</div>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm text-paper/70">{t("footer.tagline")}</p>
          </div>

          <div>
            <div className="mb-3 font-display text-sm tracking-widest text-primary">MENU</div>
            <ul className="space-y-2 text-sm">
              {navItems.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="text-paper/80 hover:text-paper">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-3 font-display text-sm tracking-widest text-primary">SOCIAL</div>
            <div className="flex gap-3">
              <a
                href="#"
                aria-label="Facebook"
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-paper/40 hover:border-primary hover:text-primary"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="#"
                aria-label="Instagram"
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-paper/40 hover:border-primary hover:text-primary"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="#"
                aria-label="WhatsApp"
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-paper/40 hover:border-primary hover:text-primary"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-paper/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-paper/50">
            <span>© {new Date().getFullYear()} Just Wheels Hessequa. {t("footer.rights")}</span>
            <span>{t("footer.built")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
