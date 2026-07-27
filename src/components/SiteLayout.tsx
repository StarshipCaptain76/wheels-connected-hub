import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import logoAsset from "@/assets/justwheels-logo.jpeg.asset.json";
import { MessageCircle, UserRound, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NewsletterSignup } from "@/components/NewsletterSignup";

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

function AuthAffordance({ onNavigate }: { onNavigate?: () => void }) {
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
        onClick={onNavigate}
        className="inline-flex items-center gap-1.5 rounded-md border-2 border-ink bg-ink px-3 py-2 text-xs font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-primary)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none sm:text-sm"
      >
        <UserRound className="h-4 w-4" /> {t("nav.members")}
      </Link>
    );
  }
  return (
    <Link
      to="/auth"
      onClick={onNavigate}
      className="inline-flex items-center rounded-md border-2 border-ink bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none sm:text-sm"
    >
      {t("nav.signIn")}
    </Link>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setMenuOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (menuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const navItems = [
    { to: "/", label: t("nav.home") },
    { to: "/events", label: t("nav.events") },
    { to: "/gallery", label: t("nav.gallery") },
    { to: "/classifieds", label: t("nav.classifieds") },
    { to: "/shop", label: t("nav.shop") },
    { to: "/sponsors", label: t("nav.sponsors") },
    { to: "/about", label: t("nav.about") },
    { to: "/join", label: t("nav.join") },
    { to: "/contact", label: t("nav.contact") },
  ] as const;

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      {/* Single sticky header — no second mobile strip */}
      <header className="sticky top-0 z-40 border-b-2 border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-3" onClick={closeMenu}>
            <img
              src={logoAsset.url}
              alt="Just Wheels Hessequa logo"
              className="h-10 w-10 shrink-0 rounded-full border-2 border-ink object-cover sm:h-11 sm:w-11"
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
            <div className="hidden md:block">
              <LangToggle />
            </div>
            <div className="hidden md:block">
              <AuthAffordance />
            </div>

            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border-2 border-ink bg-primary text-paper md:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t-2 border-ink bg-paper md:hidden">
            <nav aria-label="Primary" className="mx-auto max-w-6xl px-4 py-3">
              <ul className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={closeMenu}
                      className="block rounded-md px-3 py-3 text-sm font-bold uppercase tracking-wider text-ink/80 hover:bg-ink/5 hover:text-ink"
                      activeProps={{ className: "bg-primary/10 text-primary" }}
                      activeOptions={{ exact: item.to === "/" }}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-3">
                <LangToggle />
                <AuthAffordance onNavigate={closeMenu} />
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 border-t-2 border-ink bg-ink text-paper">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
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
            <div className="mb-3 font-display text-sm tracking-widest text-primary">CONTACT</div>
            <a
              href="https://wa.me/27836869237"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp Hugo van Dyk"
              className="inline-flex items-center gap-2 rounded-full border-2 border-paper/40 px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper hover:border-primary hover:text-primary"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp Hugo
            </a>
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <NewsletterSignup />
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
