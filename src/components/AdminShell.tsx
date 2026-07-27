import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import {
  LayoutGrid,
  Calendar,
  Image as ImageIcon,
  Star,
  Users,
  Tag,
  ShoppingBag,
  Handshake,
  Mail,
  Menu,
  X,
  Shield,
} from "lucide-react";

const NAV: Array<{
  group: string;
  items: Array<{ to: string; label: string; icon: typeof LayoutGrid; exact?: boolean }>;
}> = [
  {
    group: "",
    items: [{ to: "/admin", label: "Overview", icon: LayoutGrid, exact: true }],
  },
  {
    group: "Content",
    items: [
      { to: "/admin/events", label: "Events", icon: Calendar },
      { to: "/admin/gallery", label: "Gallery", icon: ImageIcon },
      { to: "/admin/featured", label: "Featured member", icon: Star },
    ],
  },
  {
    group: "Community",
    items: [
      { to: "/admin/members", label: "Members", icon: Users },
      { to: "/admin/classifieds", label: "Classifieds", icon: Tag },
    ],
  },
  {
    group: "Commerce",
    items: [
      { to: "/admin/shop", label: "Shop", icon: ShoppingBag },
      { to: "/admin/sponsors", label: "Sponsors", icon: Handshake },
    ],
  },
  {
    group: "Comms",
    items: [{ to: "/admin/newsletter", label: "Newsletter", icon: Mail }],
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
  return (
    <>
      {NAV.map((section) => (
        <div key={section.group || "root"} className="mb-4">
          {section.group ? (
            <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-ink/45">
              {section.group}
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
                    <span>{item.label}</span>
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
    NAV.flatMap((s) => s.items).find((i) => isActive(pathname, i.to, i.exact))?.label ?? "Admin";

  return (
    <SiteLayout>
      {/* Mobile admin bar — sits in document flow under site header, not a second sticky stack */}
      <div className="border-b-2 border-ink bg-paper md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Admin</p>
            <p className="truncate font-display text-lg leading-tight text-ink">{currentLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border-2 border-ink bg-primary text-paper"
            aria-label={menuOpen ? "Close admin menu" : "Open admin menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t-2 border-ink/10 bg-paper px-3 py-4">
            <div className="mb-3 flex items-center gap-2 px-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="font-display text-sm tracking-wide text-ink">Admin portal</span>
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
              <p className="font-display text-lg leading-tight text-ink">Portal</p>
            </div>
            <NavList pathname={pathname} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </SiteLayout>
  );
}
