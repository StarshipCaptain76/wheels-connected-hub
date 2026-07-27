import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ORIGINS } from "./origins";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

function gwHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey || !mapsKey) {
    throw new Error("Google Maps connector is not configured.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": mapsKey,
  } as Record<string, string>;
}

async function cacheGet(key: string) {
  const { createPublicSupabase } = await import("./public-supabase.server");
  const sb = createPublicSupabase();
  const { data } = await sb
    .from("route_cache")
    .select("payload, expires_at")
    .eq("cache_key", key)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.payload as unknown;
}

async function cachePut(key: string, payload: unknown) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("route_cache").upsert({ cache_key: key, payload: payload as never });
}

// -----------------------------------------------------------------------------
// Geocoding
// -----------------------------------------------------------------------------

const geocodeInput = z.object({ query: z.string().trim().min(2).max(200) });

export type GeocodeResult = {
  formatted: string;
  lat: number;
  lng: number;
  placeId: string;
} | null;

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => geocodeInput.parse(i))
  .handler(async ({ data }): Promise<GeocodeResult> => {
    const key = `geo:${data.query.toLowerCase()}`;
    const cached = (await cacheGet(key)) as GeocodeResult | null;
    if (cached !== null) return cached;

    const url = `${GATEWAY}/maps/api/geocode/json?address=${encodeURIComponent(data.query)}&region=za`;
    const res = await fetch(url, { headers: gwHeaders() });
    if (!res.ok) throw new Error(`Geocode failed (${res.status})`);
    const json = (await res.json()) as {
      status: string;
      results?: Array<{
        formatted_address: string;
        place_id: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
    };
    if (json.status !== "OK" || !json.results?.length) {
      await cachePut(key, null);
      return null;
    }
    const r = json.results[0];
    const payload: GeocodeResult = {
      formatted: r.formatted_address,
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      placeId: r.place_id,
    };
    await cachePut(key, payload);
    return payload;
  });

// -----------------------------------------------------------------------------
// Route (origin -> waypoints -> destination) via Routes API
// -----------------------------------------------------------------------------

const routeInput = z.object({
  origin: z.object({ lat: z.number(), lng: z.number() }),
  waypoints: z
    .array(z.object({ lat: z.number(), lng: z.number() }))
    .max(10)
    .default([]),
  destination: z.object({ lat: z.number(), lng: z.number() }),
});

export type ComputedRoute = {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
};

export const computeRoute = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => routeInput.parse(i))
  .handler(async ({ data }): Promise<ComputedRoute | null> => {
    const cacheKey =
      "route:" +
      JSON.stringify({
        o: [round(data.origin.lat), round(data.origin.lng)],
        w: data.waypoints.map((w) => [round(w.lat), round(w.lng)]),
        d: [round(data.destination.lat), round(data.destination.lng)],
      });
    const cached = (await cacheGet(cacheKey)) as ComputedRoute | null;
    if (cached !== null) return cached;

    const body = {
      origin: { location: { latLng: data.origin } },
      destination: { location: { latLng: data.destination } },
      intermediates: data.waypoints.map((w) => ({ location: { latLng: w } })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      polylineEncoding: "ENCODED_POLYLINE",
    };
    const res = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        ...gwHeaders(),
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Route failed (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      routes?: Array<{
        distanceMeters?: number;
        duration?: string; // e.g. "6132s"
        polyline?: { encodedPolyline?: string };
      }>;
    };
    const r = json.routes?.[0];
    if (!r?.polyline?.encodedPolyline) {
      await cachePut(cacheKey, null);
      return null;
    }
    const payload: ComputedRoute = {
      distanceMeters: r.distanceMeters ?? 0,
      durationSeconds: r.duration ? parseInt(r.duration, 10) : 0,
      encodedPolyline: r.polyline.encodedPolyline,
    };
    await cachePut(cacheKey, payload);
    return payload;
  });

// -----------------------------------------------------------------------------
// Distances from all fixed origin towns to a destination
// -----------------------------------------------------------------------------

const distancesInput = z.object({
  destination: z.object({ lat: z.number(), lng: z.number() }),
});

export type OriginDistance = {
  originKey: Origin["key"];
  label: string;
  distanceMeters: number;
  durationSeconds: number;
};

type Origin = (typeof ORIGINS)[number];

export const distancesFromOrigins = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => distancesInput.parse(i))
  .handler(async ({ data }): Promise<OriginDistance[]> => {
    const cacheKey =
      "dist:" +
      JSON.stringify([round(data.destination.lat), round(data.destination.lng)]);
    const cached = (await cacheGet(cacheKey)) as OriginDistance[] | null;
    if (cached) return cached;

    const body = {
      origins: ORIGINS.map((o) => ({ waypoint: { location: { latLng: { lat: o.lat, lng: o.lng } } } })),
      destinations: [
        {
          waypoint: { location: { latLng: { lat: data.destination.lat, lng: data.destination.lng } } },
        },
      ],
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
    };
    const res = await fetch(`${GATEWAY}/routes/distanceMatrix/v2:computeRouteMatrix`, {
      method: "POST",
      headers: {
        ...gwHeaders(),
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,duration,condition",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Distance matrix failed (${res.status}): ${t.slice(0, 200)}`);
    }
    const rows = (await res.json()) as Array<{
      originIndex: number;
      destinationIndex: number;
      distanceMeters?: number;
      duration?: string;
      condition?: string;
    }>;

    const results: OriginDistance[] = ORIGINS.map((o, i) => {
      const row = rows.find((r) => r.originIndex === i && r.destinationIndex === 0);
      return {
        originKey: o.key,
        label: o.label,
        distanceMeters: row?.distanceMeters ?? 0,
        durationSeconds: row?.duration ? parseInt(row.duration, 10) : 0,
      };
    });
    await cachePut(cacheKey, results);
    return results;
  });

function round(n: number) {
  return Math.round(n * 1e4) / 1e4;
}
