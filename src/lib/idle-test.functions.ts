import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isConcoursWindowOpen } from "@/lib/concours-window";
import { scoreRun, type IdleMetrics } from "@/lib/idle-test-score";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyClient = {
  from: (t: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
  auth?: any;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

async function assertAdmin(supabase: AnyClient, userId: string) {
  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(`Role check failed: ${error.message}`);
  if (!isAdmin) throw new Error("Forbidden");
}

const powertrainSchema = z.enum(["ice", "diesel", "hybrid", "ev", "other"]);

const metricsSchema = z.object({
  startDetected: z.boolean(),
  startPeak: z.number(),
  durationMs: z.number(),
  rms: z.number(),
  p2p: z.number(),
  cv: z.number(),
});

export type IdleTestRow = {
  id: string;
  event_id: string;
  vehicle_id: string;
  user_id: string;
  valid: boolean;
  superseded: boolean;
  metrics: IdleMetrics;
  vehicle_year: number | null;
  powertrain: string | null;
  era_slack: number | null;
  powertrain_slack: number | null;
  slack: number | null;
  raw_harsh: number | null;
  adjusted_harsh: number | null;
  smooth01: number | null;
  display_score: number | null;
  created_at: string;
  vehicle_label: string | null;
  tagged_display_name: string | null;
};

function asIdleMetrics(raw: unknown): IdleMetrics {
  const m = (raw ?? {}) as Partial<IdleMetrics>;
  return {
    startDetected: Boolean(m.startDetected),
    startPeak: Number(m.startPeak) || 0,
    durationMs: Number(m.durationMs) || 0,
    rms: Number(m.rms) || 0,
    p2p: Number(m.p2p) || 0,
    cv: Number(m.cv) || 0,
  };
}

async function resolveVehicleYearMeta(
  sb: AnyClient,
  veh: {
    vehicle_year?: number | null;
    vehicle_make?: string | null;
    vehicle_model?: string | null;
    powertrain?: string | null;
    garage_vehicle_id?: string | null;
  },
): Promise<{
  year: number | null;
  make: string | null;
  model: string | null;
  powertrain: string | null;
}> {
  let year = veh.vehicle_year ?? null;
  let make = veh.vehicle_make ?? null;
  let model = veh.vehicle_model ?? null;
  const powertrain = veh.powertrain ?? "ice";
  if (veh.garage_vehicle_id && (year == null || !make || !model)) {
    const { data: gv } = await sb
      .from("garage_vehicles")
      .select("year, make, model")
      .eq("id", veh.garage_vehicle_id)
      .maybeSingle();
    if (gv) {
      year = year ?? (gv.year as number | null) ?? null;
      make = make || ((gv.make as string | null) ?? null);
      model = model || ((gv.model as string | null) ?? null);
    }
  }
  return { year, make, model, powertrain };
}

async function recomputeRrStandard(sb: AnyClient, eventId: string) {
  const { error } = await sb.rpc("recompute_idle_rr_standard", { _event_id: eventId });
  if (error) throw new Error(error.message);
}

async function maybeAuthed(): Promise<{ supabase: AnyClient; userId: string } | null> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    if (!token || token.split(".").length !== 3) return null;
    const { createClient } = await import("@supabase/supabase-js");
    const url =
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      import.meta.env?.VITE_SUPABASE_URL;
    const key =
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;
    const supabase = createClient(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }) as unknown as AnyClient;
    const { data } = await supabase.auth.getUser(token);
    const userId = data?.user?.id as string | undefined;
    if (!userId) return null;
    return { supabase, userId };
  } catch {
    return null;
  }
}

export const listIdleLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ eventId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<IdleTestRow[]> => {
    const authed = await maybeAuthed();
    const { createPublicSupabase } = await import("./public-supabase.server");
    const sb = (authed?.supabase ?? createPublicSupabase()) as unknown as AnyClient;
    const userId = authed?.userId ?? null;

    let isAdmin = false;
    if (userId) {
      const { data: admin } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
      isAdmin = !!admin;
    }
    const { data: ec } = await sb
      .from("event_concours")
      .select("idle_test_revealed")
      .eq("event_id", data.eventId)
      .maybeSingle();
    const revealed = Boolean(ec?.idle_test_revealed);

    if (!isAdmin && !revealed && !userId) return [];

    let q = sb
      .from("event_idle_tests")
      .select(
        "id, event_id, vehicle_id, user_id, valid, superseded, metrics, vehicle_year, powertrain, era_slack, powertrain_slack, slack, raw_harsh, adjusted_harsh, smooth01, display_score, created_at",
      )
      .eq("event_id", data.eventId)
      .eq("valid", true)
      .eq("superseded", false)
      .order("display_score", { ascending: false });

    if (!isAdmin && !revealed && userId) {
      q = q.eq("user_id", userId);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    if (!rows?.length) return [];

    const vehicleIds = [...new Set(rows.map((r: { vehicle_id: string }) => r.vehicle_id))];
    const { data: vehicles } = await sb
      .from("event_concours_vehicles")
      .select("id, label, tagged_display_name")
      .in("id", vehicleIds);
    const byVeh = new Map<string, { label: string | null; tagged_display_name: string | null }>(
      (
        (vehicles ?? []) as Array<{
          id: string;
          label: string | null;
          tagged_display_name: string | null;
        }>
      ).map((v) => [v.id, v]),
    );

    return (rows as Array<Record<string, unknown>>).map((r) => {
      const v = byVeh.get(r.vehicle_id as string);
      return {
        id: r.id as string,
        event_id: r.event_id as string,
        vehicle_id: r.vehicle_id as string,
        user_id: r.user_id as string,
        valid: Boolean(r.valid),
        superseded: Boolean(r.superseded),
        metrics: asIdleMetrics(r.metrics),
        vehicle_year: r.vehicle_year == null ? null : Number(r.vehicle_year),
        powertrain: (r.powertrain as string | null) ?? null,
        era_slack: r.era_slack == null ? null : Number(r.era_slack),
        powertrain_slack: r.powertrain_slack == null ? null : Number(r.powertrain_slack),
        slack: r.slack == null ? null : Number(r.slack),
        raw_harsh: r.raw_harsh == null ? null : Number(r.raw_harsh),
        adjusted_harsh: r.adjusted_harsh == null ? null : Number(r.adjusted_harsh),
        smooth01: r.smooth01 == null ? null : Number(r.smooth01),
        display_score: r.display_score == null ? null : Number(r.display_score),
        created_at: r.created_at as string,
        vehicle_label: v?.label ?? null,
        tagged_display_name: v?.tagged_display_name ?? null,
      };
    });
  });

export const submitIdleTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        vehicleId: z.string().uuid(),
        metrics: metricsSchema,
        samples: z.array(z.number()).nullable().optional(),
        year: z.number().int().min(1886).max(2100).optional(),
        powertrain: powertrainSchema.optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;

    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });

    const { data: ev, error: evErr } = await sb
      .from("events")
      .select("starts_at, ends_at")
      .eq("id", data.eventId)
      .maybeSingle();
    if (evErr) throw new Error(evErr.message);
    if (!ev) throw new Error("Event not found");
    if (!isConcoursWindowOpen(ev.starts_at as string, ev.ends_at as string | null) && !isAdmin) {
      throw new Error("Idle test is only open on the event days.");
    }

    const { data: ec } = await sb
      .from("event_concours")
      .select("idle_test_enabled")
      .eq("event_id", data.eventId)
      .maybeSingle();
    if (!ec?.idle_test_enabled)
      throw new Error("Rolls-Royce Start & Idle is not enabled for this event");

    const { data: veh } = await sb
      .from("event_concours_vehicles")
      .select(
        "id, event_id, tagged_user_id, garage_vehicle_id, vehicle_year, vehicle_make, vehicle_model, powertrain",
      )
      .eq("id", data.vehicleId)
      .maybeSingle();
    if (!veh || veh.event_id !== data.eventId)
      throw new Error("Vehicle is not part of this event.");

    if (!isAdmin && (veh.tagged_user_id as string | null) !== userId) {
      throw new Error("Only the car's owner or an admin can submit an idle test.");
    }

    if (!isAdmin) {
      const { data: cin } = await sb
        .from("event_checkins")
        .select("id, is_spectator")
        .eq("event_id", data.eventId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!cin || cin.is_spectator) {
        throw new Error("Check in at the venue first.");
      }
    }

    const meta = await resolveVehicleYearMeta(sb, veh);
    const year = meta.year ?? data.year ?? null;
    const powertrain = data.powertrain ?? meta.powertrain;
    if (year == null) {
      throw new Error("Vehicle year is required before an idle test can be scored.");
    }
    if (veh.vehicle_year == null) {
      const { error: metaErr } = await sb
        .from("event_concours_vehicles")
        .update({
          vehicle_year: year,
          ...(veh.vehicle_make ? {} : { vehicle_make: meta.make }),
          ...(veh.vehicle_model ? {} : { vehicle_model: meta.model }),
          ...(veh.powertrain ? {} : { powertrain }),
        })
        .eq("id", data.vehicleId);
      if (metaErr) throw new Error(metaErr.message);
    }

    const scored = scoreRun({
      ...data.metrics,
      year,
      powertrain,
    });

    const { error: superErr } = await sb
      .from("event_idle_tests")
      .update({ superseded: true })
      .eq("event_id", data.eventId)
      .eq("vehicle_id", data.vehicleId)
      .eq("valid", true)
      .eq("superseded", false);
    if (superErr) throw new Error(superErr.message);

    const { data: row, error: insErr } = await sb
      .from("event_idle_tests")
      .insert({
        event_id: data.eventId,
        vehicle_id: data.vehicleId,
        user_id: userId,
        valid: true,
        superseded: false,
        metrics: data.metrics,
        samples: data.samples ?? null,
        start_detected: data.metrics.startDetected,
        vehicle_year: year,
        powertrain,
        era_slack: scored.eraSlack,
        powertrain_slack: scored.powertrainSlack,
        slack: scored.slack,
        raw_harsh: scored.rawHarsh,
        adjusted_harsh: scored.adjustedHarsh,
        smooth01: scored.smooth01,
        display_score: scored.displayScore,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    await recomputeRrStandard(sb, data.eventId);

    const { data: updated } = await sb
      .from("event_idle_tests")
      .select("id, display_score, smooth01")
      .eq("id", row.id)
      .maybeSingle();

    return {
      ok: true as const,
      id: row.id as string,
      smooth01: updated?.smooth01 == null ? scored.smooth01 : Number(updated.smooth01),
      displayScore:
        updated?.display_score == null ? scored.displayScore : Number(updated.display_score),
    };
  });

export const adminResetIdleTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ eventId: z.string().uuid(), vehicleId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;
    await assertAdmin(sb, userId);

    const { error } = await sb
      .from("event_idle_tests")
      .update({ superseded: true })
      .eq("event_id", data.eventId)
      .eq("vehicle_id", data.vehicleId)
      .eq("valid", true)
      .eq("superseded", false);
    if (error) throw new Error(error.message);

    await recomputeRrStandard(sb, data.eventId);
    return { ok: true as const };
  });

export const revealIdleLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ eventId: z.string().uuid(), revealed: z.boolean() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;
    await assertAdmin(sb, userId);

    const { error } = await sb
      .from("event_concours")
      .update({
        idle_test_revealed: data.revealed,
        updated_at: new Date().toISOString(),
      })
      .eq("event_id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminSetVehicleYearMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        vehicleId: z.string().uuid(),
        year: z.number().int().min(1886).max(2100).nullable(),
        make: z.string().max(80).nullable(),
        model: z.string().max(80).nullable(),
        powertrain: powertrainSchema.nullable(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;
    await assertAdmin(sb, userId);

    const { error } = await sb
      .from("event_concours_vehicles")
      .update({
        vehicle_year: data.year,
        vehicle_make: data.make,
        vehicle_model: data.model,
        powertrain: data.powertrain,
      })
      .eq("id", data.vehicleId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
