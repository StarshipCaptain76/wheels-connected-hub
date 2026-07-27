import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

export function OfflineBanner() {
  const { t } = useI18n();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;
  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500/95 px-3 py-1.5 text-xs font-medium text-black">
      <WifiOff className="h-3.5 w-3.5" />
      <span>{t("pwa.offline")}</span>
    </div>
  );
}
