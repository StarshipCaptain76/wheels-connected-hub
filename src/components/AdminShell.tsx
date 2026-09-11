import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useI18n } from "@/i18n/I18nProvider";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { CACHED_PROFILE_KEY } from "@/lib/members-cache";
import {
  LayoutGrid,
  Calendar,
  Image as ImageIcon,
  Users,
  Tag,
  ShoppingBag,
  Handshake,
  Mail,
  Shield,
  Trophy,
  BarChart3,
  Home,
  LogOut,
  UserRound,
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
      { to: "/admin/polls", label: "Polls", labelAf: "Peilings", icon: BarChart3 },
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
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
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
  const { lang, t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
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

  return (
    <SiteLayout
      portal="admin"
      portalMenu={(close) => (
        <div>
          <div className="mb-3 flex items-center gap-2 px-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="font-display text-sm tracking-wide text-ink">
              {lang === "af" ? "Admin-portaal" : "Admin portal"}
            </span>
          </div>
          <NavList pathname={pathname} onNavigate={close} />
          <div className="mt-3 border-t border-ink/10 pt-3">
            <Link
              to="/members"
              onClick={close}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-ink/80 hover:bg-ink/5"
            >
              <UserRound className="h-4 w-4" /> {t("portal.members")}
            </Link>
            <Link
              to="/"
              onClick={close}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-ink/80 hover:bg-ink/5"
            >
              <Home className="h-4 w-4" /> {t("portal.clubSite")}
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-ink/80 hover:bg-ink/5"
            >
              <LogOut className="h-4 w-4" /> {t("auth.signOut")}
            </button>
          </div>
        </div>
      )}
    >
      <div className="mx-auto flex max-w-6xl gap-6 px-3 py-3 sm:px-4 sm:py-6">
        <aside className="hidden w-52 flex-none md:block">
          <div className="sticky top-20 space-y-1 rounded-xl border-2 border-ink bg-paper p-3 shadow-[4px_4px_0_0_var(--color-ink)]">
            <div className="mb-3 px-2">
              <p className="font-display text-xs tracking-[0.3em] text-primary">ADMIN</p>
              <p className="font-display text-base leading-tight text-ink">
                {lang === "af" ? "Portaal" : "Portal"}
              </p>
            </div>
            <NavList pathname={pathname} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </SiteLayout>
  );
}
