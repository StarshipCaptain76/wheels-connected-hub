import { Link, useRouterState } from "@tanstack/react-router";
import { useI18n } from "@/i18n/I18nProvider";
import { useEffect, useState, type ReactNode } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import {
  LayoutGrid,
  Calendar,
  Image as ImageIcon,
  Users,
  Tag,
  ShoppingBag,
  Handshake,
  Mail,
  Menu,
  X,
  Shield,
  Trophy,
} from "lucide-react";

const NAV: Array<{
  group: string;
  groupAf: string;
  items: Array<{
    to: string;
    label: string;
    labelAf: string;
    icon: typeof LayoutGrid;
    exact?: boolean;
  }>;
}> = [
  {
    group: "",
    groupAf: "",
    items: [
      { to: "/admin", label: "Overview", labelAf: "Oorsig", icon: LayoutGrid, exact: true },
    ],
  },
  {
    group: "Content",
    groupAf: "Inhoud",
    items: [
      { to: "/admin/events", label: "Events", labelAf: "Geleenthede", icon: Calendar },
      { to: "/admin/gallery", label: "Gallery", labelAf: "Galery", icon: ImageIcon },
      { to: "/admin/concours", label: "Concours questions", labelAf: "Concours-vrae", icon: Trophy },
    ],
  },
  {
    group: "Community",
    groupAf: "Gemeenskap",
    items: [
      { to: "/admin/members", label: "Members", labelAf: "Lede", icon: Users },
      { to: "/admin/classifieds", label: "Classifieds", labelAf: "Advertensies", icon: Tag },
    ],
  },
  {
    group: "Commerce",
    groupAf: "Handel",
    items: [
      { to: "/admin/shop", label: "Shop", labelAf: "Winkel", icon: ShoppingBag },
      { to: "/admin/sponsors", label: "Sponsors", labelAf: "Borge", icon: Handshake },
    ],
  },
  {
    group: "Comms",
    groupAf: "Kommunikasie",
    items: [
      { to: "/admin/newsletter", label: "Newsletter", labelAf: "Nuusbrief", icon: Mail },
    ],
  },
];

function isActive(pathname: string, to: string, exact?: boolean) {
  if (exact) return pathname === to || pathname === to + "/";
  return pathname === to || pathname.startsWith(to + "/");
}

function NavList({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const { lang } = useI18n();
  return (
    <>
      {NAV.map((section) => (
        <div key={section.group || "root"} className="mb-4">
          {section.group ? (
            <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-ink/45">
              {lang === "af" ? section.groupAf : section.group}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item.to, item.exact);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-ink text-paper shadow-[2px_2px_0_0_var(--color-primary)]"
                        : "text-ink/80 hover:bg-ink/5 hover:text-ink"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{lang === "af" ? item.labelAf : item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { lang } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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

  const currentLabel =
    NAV.flatMap((s) => s.items).find((i) => isActive(pathname, i.to, i.exact))?.[lang === "af" ? "labelAf" : "label"] ?? "Admin";

  return (
    <SiteLayout>
      {/* Mobile admin bar — sits in document flow under site header, not a second sticky stack */}
      <div className="border-b-2 border-ink bg-paper md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{lang === "af" ? "Admin" : "Admin"}</p>
            <p className="truncate font-display text-lg leading-tight text-ink">{currentLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border-2 border-ink bg-primary text-paper"
            aria-label={menuOpen ? (lang === "af" ? "Sluit admin kieslys" : "Close admin menu") : lang === "af" ? "Open admin kieslys" : "Open admin menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t-2 border-ink/10 bg-paper px-3 py-4">
            <div className="mb-3 flex items-center gap-2 px-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="font-display text-sm tracking-wide text-ink">{lang === "af" ? "Admin portaal" : "Admin portal"}</span>
            </div>
            <NavList pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          </div>
        )}
      </div>

      <div className="mx-auto flex max-w-6xl gap-6 px-3 py-4 sm:px-4 sm:py-8">
        <aside className="hidden w-56 flex-none md:block">
          <div className="sticky top-24 space-y-1 rounded-2xl border-2 border-ink bg-paper p-4 shadow-[4px_4px_0_0_var(--color-ink)]">
            <div className="mb-4">
              <p className="font-display text-xs tracking-[0.3em] text-primary">ADMIN</p>
              <p className="font-display text-lg leading-tight text-ink">{lang === "af" ? "Portaal" : "Portal"}</p>
            </div>
            <NavList pathname={pathname} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </SiteLayout>
  );
}
