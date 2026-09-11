import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import {
  Bell,
  Car,
  Home,
  IdCard,
  Image as ImageIcon,
  LogOut,
  Plus,
  Shield,
  UserRound,
  Users,
} from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoles } from "@/lib/roles.functions";
import { CACHED_PROFILE_KEY } from "@/lib/members-cache";

const itemCls =
  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-ink/80 hover:bg-ink/5 hover:text-ink";
const itemActive = "bg-primary/10 text-primary";

export function MembersShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchRoles = useServerFn(getMyRoles);
  const { data: roles } = useQuery({
    queryKey: ["roles", "me"],
    queryFn: () => fetchRoles(),
  });

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
      portal="members"
      portalMenu={(close) => (
        <div className="space-y-4">
          <p className="px-3 font-display text-xs tracking-[0.25em] text-primary">
            {t("portal.members").toUpperCase()}
          </p>
          <ul className="flex flex-col gap-0.5">
            <li>
              <Link
                to="/members"
                hash="garage"
                onClick={close}
                className={itemCls}
                activeProps={{ className: itemActive }}
                activeOptions={{ exact: true }}
              >
                <Car className="h-4 w-4 text-primary" /> {t("portal.garage")}
              </Link>
            </li>
            <li>
              <Link to="/members" hash="garage-add" onClick={close} className={itemCls}>
                <Plus className="h-4 w-4 text-primary" /> {t("portal.addVehicle")}
              </Link>
            </li>
            <li>
              <Link
                to="/members/card"
                onClick={close}
                className={itemCls}
                activeProps={{ className: itemActive }}
              >
                <IdCard className="h-4 w-4 text-primary" /> {t("portal.card")}
              </Link>
            </li>
            <li>
              <Link
                to="/members/directory"
                onClick={close}
                className={itemCls}
                activeProps={{ className: itemActive }}
              >
                <Users className="h-4 w-4 text-primary" /> {t("portal.directory")}
              </Link>
            </li>
            <li>
              <Link to="/members" hash="profile" onClick={close} className={itemCls}>
                <UserRound className="h-4 w-4 text-primary" /> {t("portal.profile")}
              </Link>
            </li>
            <li>
              <Link to="/members" hash="photos" onClick={close} className={itemCls}>
                <ImageIcon className="h-4 w-4 text-primary" /> {t("portal.photos")}
              </Link>
            </li>
            <li>
              <Link
                to="/members/notifications"
                onClick={close}
                className={itemCls}
                activeProps={{ className: itemActive }}
              >
                <Bell className="h-4 w-4 text-primary" /> {t("notif.title")}
              </Link>
            </li>
            {roles?.isAdmin && (
              <li>
                <Link
                  to="/admin"
                  onClick={close}
                  className={itemCls}
                  activeProps={{ className: itemActive }}
                >
                  <Shield className="h-4 w-4 text-primary" /> {t("portal.admin")}
                </Link>
              </li>
            )}
          </ul>
          <div className="border-t border-ink/10 pt-3">
            <Link to="/" onClick={close} className={itemCls}>
              <Home className="h-4 w-4" /> {t("portal.clubSite")}
            </Link>
            <button type="button" onClick={() => void signOut()} className={`w-full ${itemCls}`}>
              <LogOut className="h-4 w-4" /> {t("auth.signOut")}
            </button>
          </div>
        </div>
      )}
    >
      {children}
    </SiteLayout>
  );
}
