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
  lat: number;
  lng: number;
};

/** Nominatim (OSM) — no API key, ZA bias */
async function searchNominatim(q: string): Promise<Suggestion[]> {
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      q,
      format: "json",
      addressdetails: "1",
      limit: "6",
      countrycodes: "za",
    }).toString();
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const rows = (await res.json()) as Array<{
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
    name?: string;
  }>;
  return rows.map((r) => {
    const parts = r.display_name.split(",");
    return {
      placeId: `osm:${r.place_id}`,
      description: r.display_name,
      mainText: parts[0]?.trim() || r.display_name,
      secondaryText: parts.slice(1).join(",").trim(),
      lat: Number(r.lat),
      lng: Number(r.lon),
    };
  });
}

async function reverseNominatim(lat: number, lng: number): Promise<PlaceResult> {
  const url =
    "https://nominatim.openstreetmap.org/reverse?" +
    new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: "json",
    }).toString();
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.ok) {
      const j = (await res.json()) as { display_name?: string; place_id?: number };
      if (j.display_name) {
        return {
          formatted: j.display_name,
          lat,
          lng,
          placeId: j.place_id != null ? `osm:${j.place_id}` : `manual:${lat},${lng}`,
        };
      }
    }
  } catch {
    /* fall through */
  }
  return {
    formatted: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    lat,
    lng,
    placeId: `manual:${lat},${lng}`,
  };
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
  const [error, setError] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

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
        const rows = await searchNominatim(q.trim());
        setSuggestions(rows);
        setOpen(rows.length > 0);
        if (rows.length === 0) setError("No matches — try a fuller address or Choose on map");
      } catch (e) {
        setSuggestions([]);
        setOpen(false);
        setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        setLoading(false);
      }
    }, 350);
  }, []);

  function pick(s: Suggestion) {
    setOpen(false);
    setSuggestions([]);
    onChange(s.description);
    onResolved({
      formatted: s.description,
      lat: s.lat,
      lng: s.lng,
      placeId: s.placeId,
    });
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
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink/40" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-0 max-h-60 w-full overflow-auto rounded-md border-2 border-ink bg-paper shadow-[3px_3px_0_0_var(--color-ink)]">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                onClick={() => pick(s)}
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

/** Leaflet via CDN — no API key, always shows tiles */
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
  const pinRef = useRef<{ lat: number; lng: number } | null>(null);
  const leafletMap = useRef<any>(null);
  const marker = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        // CSS
        if (!document.querySelector('link[data-jw-leaflet]')) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          link.dataset.jwLeaflet = "1";
          document.head.appendChild(link);
        }
        // JS
        const L = await loadLeaflet();
        if (cancelled || !mapRef.current) return;

        const map = L.map(mapRef.current).setView([-34.37, 21.41], 11);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);

        leafletMap.current = map;

        map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
          const { lat, lng } = e.latlng;
          pinRef.current = { lat, lng };
          if (marker.current) map.removeLayer(marker.current);
          marker.current = L.marker([lat, lng], { draggable: true }).addTo(map);
          marker.current.on("dragend", () => {
            const p = marker.current.getLatLng();
            pinRef.current = { lat: p.lat, lng: p.lng };
          });
        });

        // Force size after modal paint
        setTimeout(() => map.invalidateSize(), 50);
        setTimeout(() => map.invalidateSize(), 250);
        setReady(true);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Map failed to load");
      }
    }

    void boot();
    return () => {
      cancelled = true;
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  async function confirm() {
    if (!pinRef.current) {
      setErr("Click the map to drop a pin first");
      return;
    }
    setPicking(true);
    setErr(null);
    try {
      const r = await reverseNominatim(pinRef.current.lat, pinRef.current.lng);
      onPick(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not resolve address");
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
          <p className="text-xs text-ink/50">
            {ready ? "Pin ready when you click the map" : "Loading map…"}
          </p>
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

function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-jw-leaflet-js]');
    if (existing) {
      const t = setInterval(() => {
        if (w.L) {
          clearInterval(t);
          resolve(w.L);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(t);
        reject(new Error("Leaflet timeout"));
      }, 10000);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.dataset.jwLeafletJs = "1";
    s.onload = () => resolve(w.L);
    s.onerror = () => reject(new Error("Leaflet failed to load"));
    document.head.appendChild(s);
  });
}
