/** Browser Google Maps JS API loader — uses your own key from Vercel env. */

declare global {
  interface Window {
    google?: any;
    __jwMapsReady?: () => void;
  }
}

let mapsPromise: Promise<any> | null = null;

export function getGoogleMapsBrowserKey(): string | undefined {
  return (
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
    (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined)
  );
}

/**
 * Load Maps JS with places + geometry.
 * Key must allow referrer https://www.justwheels.co.za/*
 */
export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Maps only available in the browser"));
  }
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (mapsPromise) return mapsPromise;

  const key = getGoogleMapsBrowserKey();
  if (!key) {
    return Promise.reject(
      new Error(
        "Missing VITE_GOOGLE_MAPS_API_KEY — set it in Vercel → Settings → Environment Variables",
      ),
    );
  }

  mapsPromise = new Promise((resolve, reject) => {
    window.__jwMapsReady = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error("Google Maps failed to initialise"));
    };

    const existing = document.querySelector('script[data-jw-gmaps="1"]');
    if (existing) {
      const t = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(t);
          resolve(window.google);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(t);
        reject(new Error("Google Maps load timeout"));
      }, 15000);
      return;
    }

    const s = document.createElement("script");
    s.dataset.jwGmaps = "1";
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&loading=async&libraries=places,geometry&callback=__jwMapsReady`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Google Maps script failed to load"));
    document.head.appendChild(s);
  });

  return mapsPromise;
}
