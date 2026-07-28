/// <reference types="google.maps" />
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MapPin, X } from "lucide-react";

export type PlaceResult = {
  formatted: string;
  lat: number;
  lng: number;
  placeId: string;
};

type Suggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
};

let mapsPromise: Promise<typeof google> | null = null;

function getBrowserKey(): string | undefined {
  return import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
}

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const w = window as unknown as { google?: typeof google };
  if (w.google?.maps?.places) return Promise.resolve(w.google);
  if (w.google?.maps) {
    // maps loaded but places missing — still resolve; places may need reload
    return Promise.resolve(w.google);
  }
  if (mapsPromise) return mapsPromise;
  const key = getBrowserKey();
  if (!key) return Promise.reject(new Error("Google Maps browser key missing (VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY)"));

  mapsPromise = new Promise((resolve, reject) => {
    const cbName = "__jwMapsPlacesInit";
    (window as unknown as Record<string, unknown>)[cbName] = () => {
      const g = (window as unknown as { google: typeof google }).google;
      if (g?.maps) resolve(g);
      else reject(new Error("Google Maps failed to initialise"));
    };
    const existing = document.querySelector('script[data-jw-maps="1"]');
    if (existing) {
      // script already injected — wait a tick for google
      const t = setInterval(() => {
        const g = (window as unknown as { google?: typeof google }).google;
        if (g?.maps) {
          clearInterval(t);
          resolve(g);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(t);
        reject(new Error("Google Maps load timeout"));
      }, 15000);
      return;
    }
    const s = document.createElement("script");
    s.dataset.jwMaps = "1";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&libraries=places,geometry&callback=${cbName}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Google Maps script failed to load"));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

export function PlacePicker({
  value,
  onChange,
  onResolved,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onResolved: (r: PlaceResult) => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesRef = useRef<google.maps.places.PlacesService | null>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function ensureServices() {
    const g = await loadGoogleMaps();
    if (!serviceRef.current) {
      serviceRef.current = new g.maps.places.AutocompleteService();
    }
    if (!placesRef.current) {
      // PlacesService needs a DOM node
      const div = document.createElement("div");
      placesRef.current = new g.maps.places.PlacesService(div);
    }
    if (!sessionToken.current) {
      sessionToken.current = new g.maps.places.AutocompleteSessionToken();
    }
    return g;
  }

  const search = useCallback((q: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        await ensureServices();
        const svc = serviceRef.current!;
        svc.getPlacePredictions(
          {
            input: q.trim(),
            componentRestrictions: { country: "za" },
            sessionToken: sessionToken.current ?? undefined,
          },
          (preds, status) => {
            setLoading(false);
            if (
              status !== google.maps.places.PlacesServiceStatus.OK ||
              !preds?.length
            ) {
              setSuggestions([]);
              setOpen(false);
              if (status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                setError(`Places: ${status}`);
              }
              return;
            }
            setSuggestions(
              preds.slice(0, 6).map((p) => ({
                placeId: p.place_id,
                description: p.description,
                mainText: p.structured_formatting?.main_text ?? p.description,
                secondaryText: p.structured_formatting?.secondary_text ?? "",
              })),
            );
            setOpen(true);
          },
        );
      } catch (e) {
        setLoading(false);
        setError(e instanceof Error ? e.message : "Places failed");
        setSuggestions([]);
        setOpen(false);
      }
    }, 250);
  }, []);

  async function pick(s: Suggestion) {
    setOpen(false);
    setSuggestions([]);
    setResolving(true);
    setError(null);
    try {
      await ensureServices();
      const places = placesRef.current!;
      await new Promise<void>((resolve) => {
        places.getDetails(
          {
            placeId: s.placeId,
            fields: ["formatted_address", "geometry", "place_id", "name"],
            sessionToken: sessionToken.current ?? undefined,
          },
          (place, status) => {
            sessionToken.current = new google.maps.places.AutocompleteSessionToken();
            if (
              status !== google.maps.places.PlacesServiceStatus.OK ||
              !place?.geometry?.location
            ) {
              onChange(s.description);
              resolve();
              return;
            }
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            const formatted =
              place.formatted_address ?? place.name ?? s.description;
            onChange(formatted);
            onResolved({
              formatted,
              lat,
              lng,
              placeId: place.place_id ?? s.placeId,
            });
            resolve();
          },
        );
      });
    } catch (e) {
      onChange(s.description);
      setError(e instanceof Error ? e.message : "Could not resolve place");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative space-y-2">
      <div className="relative">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            search(e.target.value);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          className="mt-1 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 pr-10"
          placeholder={placeholder ?? "Start typing an address in South Africa…"}
          autoComplete="off"
        />
        {(loading || resolving) && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink/40" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-0 max-h-60 w-full overflow-auto rounded-md border-2 border-ink bg-paper shadow-[3px_3px_0_0_var(--color-ink)]">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                onClick={() => void pick(s)}
                className="flex w-full flex-col items-start gap-0.5 border-b border-ink/10 px-3 py-2 text-left last:border-0 hover:bg-ink/5"
              >
                <span className="text-sm font-semibold text-ink">{s.mainText}</span>
                {s.secondaryText ? (
                  <span className="text-xs text-ink/55">{s.secondaryText}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setMapOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border-2 border-ink bg-paper px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-ink hover:bg-ink/5"
      >
        <MapPin className="h-3.5 w-3.5 text-primary" />
        Choose on map
      </button>

      {error && <p className="text-xs text-primary">{error}</p>}

      {mapOpen && (
        <MapPickModal
          initialLat={null}
          initialLng={null}
          onClose={() => setMapOpen(false)}
          onPick={(r) => {
            onChange(r.formatted);
            onResolved(r);
            setMapOpen(false);
          }}
        />
      )}
    </div>
  );
}

function MapPickModal({
  onClose,
  onPick,
}: {
  initialLat: number | null;
  initialLng: number | null;
  onClose: () => void;
  onPick: (r: PlaceResult) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const mapObj = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !mapRef.current) return;
        // Default center: Hessequa / Stilbaai area
        const center = { lat: -34.37, lng: 21.41 };
        const map = new g.maps.Map(mapRef.current, {
          center,
          zoom: 11,
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: false,
        });
        mapObj.current = map;

        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          if (markerRef.current) markerRef.current.setMap(null);
          markerRef.current = new g.maps.Marker({
            position: { lat, lng },
            map,
            draggable: true,
          });
          markerRef.current.addListener("dragend", () => {
            /* keep marker; confirm on button */
          });
        });

        setReady(true);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  async function confirm() {
    const pos = markerRef.current?.getPosition();
    if (!pos) {
      setErr("Click the map to drop a pin first");
      return;
    }
    setPicking(true);
    setErr(null);
    const lat = pos.lat();
    const lng = pos.lng();
    try {
      const g = await loadGoogleMaps();
      const geocoder = new g.maps.Geocoder();
      const { results } = await geocoder.geocode({ location: { lat, lng } });
      const top = results?.[0];
      onPick({
        formatted: top?.formatted_address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat,
        lng,
        placeId: top?.place_id ?? `manual:${lat},${lng}`,
      });
    } catch {
      onPick({
        formatted: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat,
        lng,
        placeId: `manual:${lat},${lng}`,
      });
    } finally {
      setPicking(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/80 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border-2 border-ink bg-paper shadow-[6px_6px_0_0_var(--color-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-ink px-4 py-3">
          <div>
            <p className="font-display text-xl text-ink">Choose on map</p>
            <p className="text-xs text-ink/55">Click to drop a pin, drag to adjust, then confirm.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border-2 border-ink p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div ref={mapRef} className="h-80 w-full bg-ink/10 sm:h-96" />
        {err && <p className="border-t border-ink/20 px-4 py-2 text-xs text-primary">{err}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-ink px-4 py-3">
          <p className="text-xs text-ink/50">{ready ? "Pin ready when you click the map" : "Loading map…"}</p>
          <button
            type="button"
            disabled={picking}
            onClick={() => void confirm()}
            className="inline-flex items-center gap-2 rounded-md border-2 border-ink bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-paper disabled:opacity-60"
          >
            {picking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
            Use this location
          </button>
        </div>
      </div>
    </div>
  );
}
