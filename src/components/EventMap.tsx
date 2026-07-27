import { useEffect, useRef, useState } from "react";

type LatLng = { lat: number; lng: number };

export type EventMapProps = {
  destination: LatLng | null;
  waypoints?: Array<LatLng & { label?: string }>;
  encodedPolyline?: string | null;
  className?: string;
};

let mapsPromise: Promise<typeof google> | null = null;

function loadMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const w = window as unknown as { google?: typeof google };
  if (w.google?.maps) return Promise.resolve(w.google);
  if (mapsPromise) return mapsPromise;
  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  if (!key) return Promise.reject(new Error("Google Maps browser key missing"));
  mapsPromise = new Promise((resolve, reject) => {
    (window as unknown as Record<string, unknown>).__jwInitMap = () => {
      const g = (window as unknown as { google: typeof google }).google;
      if (g) resolve(g);
      else reject(new Error("Google Maps failed to initialise"));
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&libraries=geometry&callback=__jwInitMap`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Google Maps script failed to load"));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

export function EventMap({ destination, waypoints = [], encodedPolyline, className }: EventMapProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!destination || !ref.current) return;
    loadMaps()
      .then((g) => {
        if (cancelled || !ref.current) return;
        const map = new g.maps.Map(ref.current, {
          center: destination,
          zoom: 9,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });

        new g.maps.Marker({
          position: destination,
          map,
          label: { text: "★", color: "#fff", fontSize: "14px", fontWeight: "700" },
          title: "Destination",
        });

        waypoints.forEach((w, i) => {
          new g.maps.Marker({
            position: { lat: w.lat, lng: w.lng },
            map,
            label: { text: String(i + 1), color: "#fff", fontSize: "12px", fontWeight: "700" },
            title: w.label ?? `Stop ${i + 1}`,
          });
        });

        const bounds = new g.maps.LatLngBounds();
        bounds.extend(destination);
        waypoints.forEach((w) => bounds.extend({ lat: w.lat, lng: w.lng }));

        if (encodedPolyline) {
          try {
            const path = g.maps.geometry.encoding.decodePath(encodedPolyline);
            new g.maps.Polyline({
              path,
              map,
              strokeColor: "#c62828",
              strokeOpacity: 0.9,
              strokeWeight: 4,
            });
            path.forEach((p: google.maps.LatLng) => bounds.extend(p));

          } catch {
            // ignore polyline errors — pins still show
          }
        }
        if (!bounds.isEmpty()) map.fitBounds(bounds, 40);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [destination, waypoints, encodedPolyline]);

  if (!destination) {
    return (
      <div className={`flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-ink/30 bg-card text-sm text-ink/50 ${className ?? ""}`}>
        No destination set yet.
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-lg border-2 border-ink bg-card ${className ?? ""}`}>
      <div ref={ref} className="h-72 w-full sm:h-96" />
      {err && <p className="border-t-2 border-ink px-3 py-2 text-xs text-primary">{err}</p>}
    </div>
  );
}
