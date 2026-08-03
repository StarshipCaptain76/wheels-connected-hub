import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";
import {
  ADMIN_TYPES,
  DEFAULT_PREFS,
  MEMBER_TYPES,
  fetchPrefs,
  savePrefs,
  type NotificationPrefs,
  type NotificationType,
} from "@/lib/notifications";
import {
  iosNeedsInstall,
  notificationPermission,
  requestNotificationPermission,
  showDeviceNotification,
} from "@/lib/device-notifications";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-2">
      <span className="text-sm text-ink/80">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border-2 border-ink transition-colors ${checked ? "bg-primary" : "bg-paper"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full border-2 border-ink bg-paper transition-all ${checked ? "left-6" : "left-0.5"}`}
        />
      </button>
    </label>
  );
}

export function NotificationSettings({ isAdmin }: { isAdmin?: boolean }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["notification-prefs"], queryFn: fetchPrefs });
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  const [needsInstall, setNeedsInstall] = useState(false);

  useEffect(() => {
    setPerm(notificationPermission());
    setNeedsInstall(iosNeedsInstall());
  }, []);

  const deviceBody =
    perm === "unsupported"
      ? t("notif.deviceUnsupported")
      : needsInstall
        ? t("notif.deviceIos")
        : perm === "granted"
          ? t("notif.deviceOn")
          : perm === "denied"
            ? t("notif.deviceBlocked")
            : t("notif.deviceBody");

  useEffect(() => {
    if (data) setPrefs(data);
  }, [data]);


  async function update(type: NotificationType, value: boolean) {
    const next = { ...prefs, [type]: value };
    setPrefs(next);
    try {
      await savePrefs({ [type]: value });
      void qc.invalidateQueries({ queryKey: ["notification-prefs"] });
      toast.success(t("notif.saved"));
    } catch {
      setPrefs(prefs);
      toast.error(t("notif.saveFailed"));
    }
  }

  return (
    <div className="rounded-2xl border-2 border-ink bg-paper p-5 shadow-[4px_4px_0_0_var(--color-ink)]">
      <p className="font-display text-sm tracking-wide text-ink">{t("notif.settings")}</p>
      <p className="mt-1 text-xs text-ink/60">{t("notif.settingsHint")}</p>

      <div className="mt-3 rounded-lg border-2 border-ink/20 bg-ink/5 p-3">
        <p className="text-sm font-bold text-ink">{t("notif.deviceTitle")}</p>
        <p className="mt-1 text-xs text-ink/70">{deviceBody}</p>
        {perm === "default" && !needsInstall && (
          <button
            type="button"
            onClick={async () => {
              const res = await requestNotificationPermission();
              setPerm(res);
              if (res === "granted") {
                showDeviceNotification(t("notif.deviceTestTitle"), t("notif.deviceTestBody"));
              }
            }}
            className="mt-2 rounded-md border-2 border-ink bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-paper"
          >
            {t("notif.deviceAllow")}
          </button>
        )}
      </div>


      <div className="mt-3 divide-y divide-ink/10">
        {MEMBER_TYPES.map((type) => (
          <Toggle
            key={type}
            checked={prefs[type]}
            onChange={(v) => void update(type, v)}
            label={t(`notif.type.${type}`)}
          />
        ))}
      </div>
      {isAdmin && (
        <>
          <p className="mt-4 font-display text-xs tracking-[0.25em] text-primary">
            {t("notif.adminSection")}
          </p>
          <div className="mt-1 divide-y divide-ink/10">
            {ADMIN_TYPES.map((type) => (
              <Toggle
                key={type}
                checked={prefs[type]}
                onChange={(v) => void update(type, v)}
                label={t(`notif.type.${type}`)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
