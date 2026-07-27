import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
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
} from "lucide-react";

const NAV: Array<{ group: string; items: Array<{ to: string; label: string; icon: typeof LayoutGrid; exact?: boolean }> }> = [
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

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <SiteLayout>
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-8">
        <aside className="hidden w-56 flex-none md:block">
          <div className="sticky top-24 space-y-5 rounded-2xl border-2 border-ink bg-paper p-4 shadow-[4px_4px_0_0_var(--color-ink)]">
            <div>
              <p className="font-display text-xs tracking-[0.3em] text-primary">ADMIN</p>
              <p className="font-display text-lg leading-tight text-ink">Portal</p>
            </div>
            {NAV.map((section) => (
              <div key={section.group || "root"}>
                {section.group && (
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-ink/50">
                    {section.group}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");
                    const Icon = item.icon;
                    return (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm font-semibold ${
                            active
                              ? "bg-ink text-paper"
                              : "text-ink/80 hover:bg-ink/5 hover:text-ink"
                          }`}
                        >
                          <Icon className="h-4 w-4" /> {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Mobile top tab bar */}
        <div className="fixed inset-x-0 top-[64px] z-30 border-b-2 border-ink bg-paper/95 backdrop-blur md:hidden">
          <nav className="flex gap-1 overflow-x-auto px-3 py-2">
            {NAV.flatMap((s) => s.items).map((item) => {
              const active = item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`shrink-0 rounded-full border-2 border-ink px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                    active ? "bg-ink text-paper" : "bg-paper text-ink/70"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <main className="min-w-0 flex-1 pt-12 md:pt-0">{children}</main>
      </div>
    </SiteLayout>
  );
}
