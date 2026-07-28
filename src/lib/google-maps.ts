/** Browser Google Maps JS API loader — uses VITE_GOOGLE_MAPS_API_KEY from Vercel. */

declare global {
  interface Window {
    google?: any;
    __jwMapsReady?: () => void;
  }
}

let mapsPromise: Promise<any> | null = null;

export function getGoogleMapsBrowserKey(): string | undefined {
  const key =
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
    (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined);
  const trimmed = key?.trim();
  return trimmed || undefined;
}

function mapsHasPlaces(): boolean {
  return Boolean(typeof window !== "undefined" && window.google?.maps?.places);
}

/**
 * Load Maps JS with places + geometry.
 * Key must allow referrer https://www.justwheels.co.za/*
 */
export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Maps only available in the browser"));
  }

  if (mapsHasPlaces()) return Promise.resolve(window.google);
  if (mapsPromise) return mapsPromise;

  const key = getGoogleMapsBrowserKey();
  if (!key) {
    return Promise.reject(
      new Error(
        "Missing VITE_GOOGLE_MAPS_API_KEY — set it in Vercel → Settings → Environment Variables, then Redeploy",
      ),
    );
  }

  mapsPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (mapsHasPlaces()) {
        resolve(window.google);
        return true;
      }
      return false;
    };

    window.__jwMapsReady = () => {
      // places can lag a tick after callback
      if (finish()) return;
      setTimeout(() => {
        if (finish()) return;
        reject(new Error("Google Maps loaded but Places library is missing"));
      }, 200);
    };

    const existing = document.querySelector('script[data-jw-gmaps="1"]') as HTMLScriptElement | null;
    if (existing) {
      let tries = 0;
      const t = setInterval(() => {
        tries += 1;
        if (finish()) {
          clearInterval(t);
        } else if (tries > 100) {
          clearInterval(t);
          mapsPromise = null;
          reject(new Error("Google Maps load timeout — check API key & referrer restrictions"));
        }
      }, 100);
      return;
    }

    const s = document.createElement("script");
    s.dataset.jwGmaps = "1";
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&v=weekly&libraries=places,geometry&callback=__jwMapsReady`;
    s.async = true;
    s.defer = true;
    s.onerror = () => {
      mapsPromise = null;
      reject(
        new Error(
          "Google Maps script failed to load (blocked key or network). Check VITE_GOOGLE_MAPS_API_KEY and website restrictions.",
        ),
      );
    };
    document.head.appendChild(s);
  });

  return mapsPromise;
}

/** True if a browser key is configured at build time. */
export function hasGoogleMapsKey(): boolean {
  return Boolean(getGoogleMapsBrowserKey());
}
