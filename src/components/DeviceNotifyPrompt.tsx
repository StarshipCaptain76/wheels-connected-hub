import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  deviceNotifPromptSnoozed,
  iosNeedsInstall,
  notificationPermission,
  requestNotificationPermission,
  showDeviceNotification,
  snoozeDeviceNotifPrompt,
} from "@/lib/device-notifications";

export const DEVICE_NOTIF_OPEN_EVENT = "jw:open-device-notifications";

/** Asks signed-in members whether to allow notifications on this device. */
export function DeviceNotifyPrompt() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

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

  useEffect(() => {
    const evaluate = (force: boolean) => {
      const perm = notificationPermission();
      if (perm === "granted") {
        if (force) setVisible(true);
        else return;
      }
      if (!force && (perm !== "default" || deviceNotifPromptSnoozed())) return;
      setVisible(true);
    };

    if (signedIn) {
      const id = window.setTimeout(() => evaluate(false), 4000);
      const onManual = () => evaluate(true);
      window.addEventListener(DEVICE_NOTIF_OPEN_EVENT, onManual);
      return () => {
        window.clearTimeout(id);
        window.removeEventListener(DEVICE_NOTIF_OPEN_EVENT, onManual);
      };
    }

    const onManual = () => evaluate(true);
    window.addEventListener(DEVICE_NOTIF_OPEN_EVENT, onManual);
    return () => window.removeEventListener(DEVICE_NOTIF_OPEN_EVENT, onManual);
  }, [signedIn]);

  if (!visible) return null;

  const perm = notificationPermission();
  const needsInstall = iosNeedsInstall();

  const body =
    perm === "unsupported"
      ? t("notif.deviceUnsupported")
      : needsInstall
        ? t("notif.deviceIos")
        : perm === "denied"
          ? t("notif.deviceBlocked")
          : perm === "granted"
            ? t("notif.deviceOn")
            : t("notif.deviceBody");

  const dismiss = () => {
    snoozeDeviceNotifPrompt();
    setVisible(false);
  };

  const allow = async () => {
    const result = await requestNotificationPermission();
    if (result === "granted") {
      showDeviceNotification(t("notif.deviceTestTitle"), t("notif.deviceTestBody"));
      setVisible(false);
    }
    snoozeDeviceNotifPrompt();
  };

  const canAsk = perm === "default" && !needsInstall;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl border border-border bg-card p-4 shadow-lg sm:inset-x-auto sm:right-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/15 p-2 text-primary">
          <Bell className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">{t("notif.deviceTitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{body}</p>
          <div className="mt-3 flex gap-2">
            {canAsk && (
              <button
                onClick={() => void allow()}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90"
              >
                {t("notif.deviceAllow")}
              </button>
            )}
            <button
              onClick={dismiss}
              className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              {canAsk ? t("pwa.later") : t("pwa.gotIt")}
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
