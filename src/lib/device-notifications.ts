// Browser (device-level) notification helpers. Purely client-side: we mirror
// in-app notifications as OS notifications while a tab is open.

export const DEVICE_NOTIF_SNOOZE_KEY = "jw.deviceNotifSnoozedUntil";
export const DEVICE_NOTIF_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

/** iOS only allows web notifications once the app is added to the home screen. */
export function iosNeedsInstall(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!ios) return false;
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return !standalone;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function snoozeDeviceNotifPrompt() {
  try {
    localStorage.setItem(
      DEVICE_NOTIF_SNOOZE_KEY,
      String(Date.now() + DEVICE_NOTIF_SNOOZE_MS),
    );
  } catch {
    // ignore
  }
}

export function deviceNotifPromptSnoozed(): boolean {
  try {
    const until = Number(localStorage.getItem(DEVICE_NOTIF_SNOOZE_KEY) || 0);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

export function showDeviceNotification(title: string, body?: string, link?: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: link ?? title,
    });
    n.onclick = () => {
      window.focus();
      if (link) window.location.assign(link);
      n.close();
    };
  } catch {
    // ignore
  }
}
