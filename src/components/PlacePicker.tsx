import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MapPin, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/google-maps";

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
  const [mapsStatus, setMapsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [mapOpen, setMapOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const serviceRef = useRef<any>(null);
  const placesRef = useRef<any>(null);
  const sessionToken = useRef<any>(null);

  // Preload Google Maps as soon as the picker mounts (destination / stops tab)
  useEffect(() => {
    if (!hasGoogleMapsKey()) {
      setMapsStatus("error");
      setError(
        "Google Maps key not in this build. Add VITE_GOOGLE_MAPS_API_KEY in Vercel and Redeploy.",
      );
      return;
    }
    setMapsStatus("loading");
    loadGoogleMaps()
      .then(async (g) => {
        serviceRef.current = new g.maps.places.AutocompleteService();
        const div = document.createElement("div");
        placesRef.current = new g.maps.places.PlacesService(div);
        sessionToken.current = new g.maps.places.AutocompleteSessionToken();
        setMapsStatus("ready");
        setError(null);
      })
      .catch((e) => {
        setMapsStatus("error");
        setError(e instanceof Error ? e.message : "Google Maps failed to load");
      });
  }, []);

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
        serviceRef.current.getPlacePredictions(
          {
            input: q.trim(),
            componentRestrictions: { country: "za" },
            sessionToken: sessionToken.current ?? undefined,
          },
          (preds: any[] | null, status: string) => {
            setLoading(false);
            if (status === "OK" && preds?.length) {
              setSuggestions(
                preds.slice(0, 6).map((p) => ({
                  placeId: p.place_id as string,
                  description: p.description as string,
                  mainText:
                    (p.structured_formatting?.main_text as string) ?? (p.description as string),
                  secondaryText: (p.structured_formatting?.secondary_text as string) ?? "",
                })),
              );
              setOpen(true);
              return;
            }
            setSuggestions([]);
            setOpen(false);
            if (status === "ZERO_RESULTS") return;
            if (status === "REQUEST_DENIED") {
              setError(
                "Places REQUEST_DENIED — enable Places API on the key and allow www.justwheels.co.za in website restrictions.",
              );
            } else if (status && status !== "OK") {
              setError(`Places status: ${status}`);
            }
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
      const g = await ensureServices();
      await new Promise<void>((resolve) => {
        placesRef.current.getDetails(
          {
            placeId: s.placeId,
            fields: ["formatted_address", "geometry", "place_id", "name"],
            sessionToken: sessionToken.current ?? undefined,
          },
          (place: any, status: string) => {
            sessionToken.current = new g.maps.places.AutocompleteSessionToken();
            if (status !== "OK" || !place?.geometry?.location) {
              onChange(s.description);
              if (status && status !== "OK") setError(`Place details: ${status}`);
              resolve();
              return;
            }
            const lat = place.geometry.location.lat() as number;
            const lng = place.geometry.location.lng() as number;
            const formatted =
              (place.formatted_address as string) ??
              (place.name as string) ??
              s.description;
            onChange(formatted);
            onResolved({
              formatted,
              lat,
              lng,
              placeId: (place.place_id as string) ?? s.placeId,
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
      {mapsStatus === "loading" && (
        <p className="flex items-center gap-1.5 text-[11px] text-ink/50">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading Google Places…
        </p>
      )}
      {mapsStatus === "ready" && (
        <p className="flex items-center gap-1.5 text-[11px] text-emerald-700">
          <CheckCircle2 className="h-3 w-3" /> Google search ready — type 2+ letters
        </p>
      )}
      {mapsStatus === "error" && (
        <p className="flex items-start gap-1.5 text-[11px] text-primary">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          {error ?? "Google Maps not available"}
        </p>
      )}

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

      {error && mapsStatus === "ready" && (
        <p className="text-xs text-primary">{error}</p>
      )}

      {mapOpen && (
        <MapPickModal
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
  onClose: () => void;
  onPick: (r: PlaceResult) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !mapRef.current) return;
        const center = { lat: -34.37, lng: 21.41 };
        const map = new g.maps.Map(mapRef.current, {
          center,
          zoom: 11,
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: false,
        });

        map.addListener("click", (e: any) => {
          if (!e.latLng) return;
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          if (markerRef.current) markerRef.current.setMap(null);
          markerRef.current = new g.maps.Marker({
            position: { lat, lng },
            map,
            draggable: true,
          });
        });

        setTimeout(() => g.maps.event.trigger(map, "resize"), 80);
        setTimeout(() => g.maps.event.trigger(map, "resize"), 300);
        setReady(true);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  function confirm() {
    const pos = markerRef.current?.getPosition?.();
    if (!pos) {
      setErr("Click the map to drop a pin first");
      return;
    }
    setPicking(true);
    setErr(null);
    const lat = pos.lat() as number;
    const lng = pos.lng() as number;

    loadGoogleMaps()
      .then((g) => {
        const geocoder = new g.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results: any[] | null, status: string) => {
          setPicking(false);
          if (status === "OK" && results?.[0]) {
            onPick({
              formatted: results[0].formatted_address as string,
              lat,
              lng,
              placeId: (results[0].place_id as string) ?? `manual:${lat},${lng}`,
            });
          } else {
            onPick({
              formatted: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
              lat,
              lng,
              placeId: `manual:${lat},${lng}`,
            });
          }
        });
      })
      .catch(() => {
        setPicking(false);
        onPick({
          formatted: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          lat,
          lng,
          placeId: `manual:${lat},${lng}`,
        });
      });
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
          <p className="text-xs text-ink/50">
            {ready ? "Pin ready when you click the map" : "Loading Google Map…"}
          </p>
          <button
            type="button"
            disabled={picking}
            onClick={confirm}
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
