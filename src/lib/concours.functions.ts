import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isConcoursWindowOpen } from "@/lib/concours-window";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConcoursQuestion = {
  id: string;
  category: string;
  category_af: string | null;
  text_en: string;
  text_af: string;
  scoring_type: "scale_1_10" | "yes_no" | "yes_no_na" | "count";
  sort_order: number;
  active?: boolean;
};

export type EventConcours = {
  event_id: string;
  enabled: boolean;
  question_count: number;
  selected_question_ids: string[];
  prize_en: string | null;
  prize_af: string | null;
  sponsor_name: string | null;
  sponsor_logo_url: string | null;
  leaderboard_revealed: boolean;
  winner_vehicle_id?: string | null;
  winner_photo_url?: string | null;
  winner_headline_en?: string | null;
  winner_headline_af?: string | null;
  winner_average_score?: number | null;
  winner_submission_count?: number | null;
  results_on_home?: boolean;
  results_published_at?: string | null;
};

export type ConcoursVehicle = {
  id: string;
  event_id: string;
  label: string | null;
  label_af: string | null;
  photo_url: string;
  sort_order: number;
  tagged_user_id?: string | null;
  tagged_member_number?: number | null;
  tagged_display_name?: string | null;
  garage_vehicle_id?: string | null;
  garage_label?: string | null;
  average_score?: number | null;
  submission_count?: number;
};

// New tables are not yet in generated Database types — cast through any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (t: string) => any; rpc: (fn: string, args: Record<string, unknown>) => any; auth?: any };

async function assertAdmin(supabase: AnyClient, userId: string) {
  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(`Role check failed: ${error.message}`);
  if (!isAdmin) throw new Error("Forbidden");
}

const CHECKIN_RADIUS_M = 2000; // 2 km — rural venues, GPS drift

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function pickRandomQuestions(all: ConcoursQuestion[], count: number): ConcoursQuestion[] {
  const pool = [...all];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(0, Math.min(count, pool.length)));
}

function isClubMemberStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "member";
}

function spectatorQuestionIds(selectedIds: string[]): string[] {
  const half = Math.ceil(selectedIds.length / 2);
  return selectedIds.slice(0, half);
}

function orderQuestionsByIds(rows: ConcoursQuestion[], ids: string[]): ConcoursQuestion[] {
  const byId = new Map(rows.map((q) => [q.id, q]));
  return ids.map((id) => byId.get(id)).filter((q): q is ConcoursQuestion => !!q);
}

function scoreAnswers(
  answers: Record<string, number | string | null>,
  allowedIds: string[],
): { totalScore: number; answered: number } {
  let sum = 0;
  let count = 0;
  for (const qid of allowedIds) {
    const val = answers[qid];
    if (typeof val === "number" && !Number.isNaN(val)) {
      sum += Math.max(0, Math.min(10, val));
      count += 1;
    } else if (val === "yes") {
      sum += 10;
      count += 1;
    } else if (val === "no") {
      sum += 0;
      count += 1;
    } else if (val === "na") {
      // N/A is answered but excluded from the average
    }
  }
  return {
    totalScore: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
    answered: count,
  };
}

function assertAllQuestionsAnswered(
  answers: Record<string, number | string | null>,
  allowedIds: string[],
) {
  const missing = allowedIds.filter((id) => {
    const val = answers[id];
    return val === undefined || val === null || val === "";
  });
  if (missing.length > 0) {
    throw new Error("Please answer every question before submitting.");
  }
}

function weightedAverage(
  scores: Array<{ total_score: number | null; weight: number | null }>,
): { average: number | null; count: number } {
  let wSum = 0;
  let wTot = 0;
  let count = 0;
  for (const s of scores) {
    if (s.total_score == null) continue;
    const w = Number(s.weight) || 1;
    wSum += Number(s.total_score) * w;
    wTot += w;
    count += 1;
  }
  return {
    average: wTot > 0 ? Math.round((wSum / wTot) * 10) / 10 : null,
    count,
  };
}

async function sha256Hex(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Small stable hash so a car's random question draw is reproducible at submit. */
function seedHash(raw: string): number {
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Questions for one car: the admin-selected set first, then an equal number of
 * extras drawn from the bank — deterministic per (event, vehicle), so every
 * car feels different while the server can re-validate the same set at submit.
 */
async function questionIdsForVehicle(
  sb: AnyClient,
  eventId: string,
  vehicleId: string,
  selectedIds: string[],
): Promise<{ adminIds: string[]; randomIds: string[]; allIds: string[] }> {
  const adminIds = selectedIds;
  const { data: bank } = await sb
    .from("concours_questions")
    .select("id")
    .eq("active", true);
  const chosen = new Set(adminIds);
  const pool = ((bank ?? []) as Array<{ id: string }>)
    .map((q) => q.id)
    .filter((id) => !chosen.has(id))
    .sort((a, b) => seedHash(`${eventId}:${vehicleId}:${a}`) - seedHash(`${eventId}:${vehicleId}:${b}`));
  const randomIds = pool.slice(0, adminIds.length);
  return { adminIds, randomIds, allIds: [...adminIds, ...randomIds] };
}

async function assertScoringOpen(sb: AnyClient, eventId: string) {
  const { data: ev, error } = await sb
    .from("events")
    .select("starts_at, ends_at, destination_lat, destination_lng")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!ev) throw new Error("Event not found");
  if (!isConcoursWindowOpen(ev.starts_at as string, ev.ends_at as string | null)) {
    throw new Error("Concours scoring is only open on the event days.");
  }
  return {
    starts_at: ev.starts_at as string,
    ends_at: (ev.ends_at as string | null) ?? null,
    destination_lat:
      ev.destination_lat != null && Number.isFinite(Number(ev.destination_lat))
        ? Number(ev.destination_lat)
        : null,
    destination_lng:
      ev.destination_lng != null && Number.isFinite(Number(ev.destination_lng))
        ? Number(ev.destination_lng)
        : null,
  };
}

function assertWithinVenue(
  lat: number,
  lng: number,
  destLat: number | null,
  destLng: number | null,
): number {
  if (destLat == null || destLng == null) {
    throw new Error("This event has no destination coordinates yet — ask an admin to set the map pin.");
  }
  const distanceM = haversineM(lat, lng, destLat, destLng);
  if (distanceM > CHECKIN_RADIUS_M) {
    throw new Error(
      `You seem to be about ${Math.round(distanceM / 100) / 10} km away (need to be within ${CHECKIN_RADIUS_M / 1000} km of the venue).`,
    );
  }
  return distanceM;
}

async function createAuthedSupabaseFromRequest(): Promise<{
  supabase: AnyClient;
  userId: string;
} | null> {
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

async function upsertScoreRow(
  sb: AnyClient,
  payload: Record<string, unknown>,
  kind: "member" | "spectator",
) {
  if (kind === "member") {
    const { error } = await sb.from("event_concours_scores").upsert(payload, {
      onConflict: "event_id,vehicle_id,user_id",
    });
    if (!error) return;
    const { data: row } = await sb
      .from("event_concours_scores")
      .select("id")
      .eq("event_id", payload.event_id)
      .eq("vehicle_id", payload.vehicle_id)
      .eq("user_id", payload.user_id)
      .maybeSingle();
    if (row?.id) {
      const { error: uerr } = await sb.from("event_concours_scores").update(payload).eq("id", row.id);
      if (uerr) throw new Error(uerr.message);
      return;
    }
    const { error: ierr } = await sb.from("event_concours_scores").insert(payload);
    if (ierr) throw new Error(ierr.message);
    return;
  }

  const { data: row } = await sb
    .from("event_concours_scores")
    .select("id")
    .eq("event_id", payload.event_id)
    .eq("vehicle_id", payload.vehicle_id)
    .eq("voter_fingerprint", payload.voter_fingerprint)
    .maybeSingle();
  if (row?.id) {
    const { error: uerr } = await sb.from("event_concours_scores").update(payload).eq("id", row.id);
    if (uerr) throw new Error(uerr.message);
    return;
  }
  const { error } = await sb.from("event_concours_scores").insert(payload);
  if (error) {
    if (error.code === "23505") {
      throw new Error("You have already scored this car.");
    }
    throw new Error(error.message);
  }
}

// ---------------------------------------------------------------------------
// Public reads (anon)
// ---------------------------------------------------------------------------

export const getEventConcours = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ eventId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<EventConcours | null> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const supabase = createPublicSupabase() as unknown as AnyClient;
    const { data: row, error } = await supabase
      .from("event_concours")
      .select("*")
      .eq("event_id", data.eventId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row as EventConcours | null) ?? null;
  });

export const listConcoursQuestions = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(i),
  )
  .handler(async ({ data }): Promise<ConcoursQuestion[]> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const supabase = createPublicSupabase() as unknown as AnyClient;
    const { data: rows, error } = await supabase
      .from("concours_questions")
      .select("id, category, category_af, text_en, text_af, scoring_type, sort_order")
      .eq("active", true)
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return orderQuestionsByIds((rows ?? []) as ConcoursQuestion[], data.ids);
  });

export const listConcoursVehicles = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ eventId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<ConcoursVehicle[]> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const supabase = createPublicSupabase() as unknown as AnyClient;

    const { data: vehicles, error } = await supabase
      .from("event_concours_vehicles")
      .select("*")
      .eq("event_id", data.eventId)
      .order("sort_order");
    if (error) throw new Error(error.message);
    if (!vehicles?.length) return [];

    const { data: ec } = await supabase
      .from("event_concours")
      .select("leaderboard_revealed")
      .eq("event_id", data.eventId)
      .maybeSingle();
    const revealed = Boolean(ec?.leaderboard_revealed);

    const { data: scores } = await supabase
      .from("event_concours_scores")
      .select("vehicle_id, total_score, weight")
      .eq("event_id", data.eventId);

    const byVehicle = new Map<string, { total_score: number | null; weight: number | null }[]>();
    for (const s of scores ?? []) {
      const list = byVehicle.get(s.vehicle_id) ?? [];
      list.push(s);
      byVehicle.set(s.vehicle_id, list);
    }

    return (vehicles as ConcoursVehicle[]).map((v) => {
      const stats = weightedAverage(byVehicle.get(v.id) ?? []);
      return {
        ...v,
        average_score: revealed ? stats.average : null,
        submission_count: stats.count,
      };
    });
  });

export const listConcoursVehiclesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ eventId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<ConcoursVehicle[]> => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;
    await assertAdmin(sb, userId);

    const { data: vehicles, error } = await sb
      .from("event_concours_vehicles")
      .select("*")
      .eq("event_id", data.eventId)
      .order("sort_order");
    if (error) throw new Error(error.message);
    if (!vehicles?.length) return [];

    const { data: scores } = await sb
      .from("event_concours_scores")
      .select("vehicle_id, total_score, weight")
      .eq("event_id", data.eventId);

    const byVehicle = new Map<string, { total_score: number | null; weight: number | null }[]>();
    for (const s of scores ?? []) {
      const list = byVehicle.get(s.vehicle_id) ?? [];
      list.push(s);
      byVehicle.set(s.vehicle_id, list);
    }

    return (vehicles as ConcoursVehicle[]).map((v) => {
      const stats = weightedAverage(byVehicle.get(v.id) ?? []);
      return { ...v, average_score: stats.average, submission_count: stats.count };
    });
  });

// ---------------------------------------------------------------------------
// Admin (auth required)
// ---------------------------------------------------------------------------

export const upsertEventConcours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        enabled: z.boolean(),
        questionCount: z.number().int().min(5).max(15),
        prizeEn: z.string().nullable().optional(),
        prizeAf: z.string().nullable().optional(),
        sponsorName: z.string().nullable().optional(),
        sponsorLogoUrl: z.string().nullable().optional(),
        reRollQuestions: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;
    await assertAdmin(sb, userId);

    const { data: existing } = await sb
      .from("event_concours")
      .select("*")
      .eq("event_id", data.eventId)
      .maybeSingle();

    let selectedIds: string[] = (existing?.selected_question_ids as string[] | undefined) ?? [];

    if (!existing || data.reRollQuestions || selectedIds.length === 0) {
      const { data: allQ } = await sb
        .from("concours_questions")
        .select("id, category, category_af, text_en, text_af, scoring_type, sort_order")
        .eq("active", true);
      const picked = pickRandomQuestions((allQ ?? []) as ConcoursQuestion[], data.questionCount);
      selectedIds = picked.map((q) => q.id);
    } else if (selectedIds.length !== data.questionCount) {
      const { data: allQ } = await sb
        .from("concours_questions")
        .select("id, category, category_af, text_en, text_af, scoring_type, sort_order")
        .eq("active", true);
      const bank = (allQ ?? []) as ConcoursQuestion[];
      if (selectedIds.length > data.questionCount) {
        selectedIds = selectedIds.slice(0, data.questionCount);
      } else {
        const have = new Set(selectedIds);
        const extra = pickRandomQuestions(
          bank.filter((q) => !have.has(q.id)),
          data.questionCount - selectedIds.length,
        );
        selectedIds = [...selectedIds, ...extra.map((q) => q.id)];
      }
    }

    const payload = {
      event_id: data.eventId,
      enabled: data.enabled,
      question_count: data.questionCount,
      selected_question_ids: selectedIds,
      prize_en: data.prizeEn ?? null,
      prize_af: data.prizeAf ?? null,
      sponsor_name: data.sponsorName ?? null,
      sponsor_logo_url: data.sponsorLogoUrl ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb.from("event_concours").upsert(payload, { onConflict: "event_id" });
    if (error) throw new Error(error.message);
    return { ok: true as const, selectedCount: selectedIds.length };
  });

export const revealConcoursLeaderboard = createServerFn({ method: "POST" })
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
        leaderboard_revealed: data.revealed,
        updated_at: new Date().toISOString(),
      })
      .eq("event_id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const addConcoursVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        photoUrl: z.string().url(),
        label: z.string().nullable().optional(),
        labelAf: z.string().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;
    await assertAdmin(sb, userId);

    const { count } = await sb
      .from("event_concours_vehicles")
      .select("*", { count: "exact", head: true })
      .eq("event_id", data.eventId);

    const { data: row, error } = await sb
      .from("event_concours_vehicles")
      .insert({
        event_id: data.eventId,
        photo_url: data.photoUrl,
        label: data.label ?? null,
        label_af: data.labelAf ?? null,
        sort_order: count ?? 0,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as ConcoursVehicle;
  });

/** Admin: add many cars in one go — photos only, no labels, no tagging. */
export const addConcoursVehiclesBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        photoUrls: z.array(z.string().url()).min(1).max(40),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;
    await assertAdmin(sb, userId);

    const { count } = await sb
      .from("event_concours_vehicles")
      .select("*", { count: "exact", head: true })
      .eq("event_id", data.eventId);
    const base = count ?? 0;

    const rows = data.photoUrls.map((url, i) => ({
      event_id: data.eventId,
      photo_url: url,
      label: null,
      label_af: null,
      sort_order: base + i,
    }));

    const { data: inserted, error } = await sb
      .from("event_concours_vehicles")
      .insert(rows)
      .select("id");
    if (error) throw new Error(error.message);
    return { ok: true as const, added: (inserted ?? []).length };
  });

/** Question set for one car: admin picks + a per-car random draw. */
export const getVehicleQuestionSet = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        vehicleId: z.string().uuid(),
        full: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }): Promise<ConcoursQuestion[]> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const sb = createPublicSupabase() as unknown as AnyClient;

    const { data: ec } = await sb
      .from("event_concours")
      .select("selected_question_ids, enabled")
      .eq("event_id", data.eventId)
      .maybeSingle();
    const selectedIds: string[] = (ec?.selected_question_ids as string[]) ?? [];
    if (!ec?.enabled || selectedIds.length === 0) return [];

    const { adminIds, allIds } = await questionIdsForVehicle(
      sb,
      data.eventId,
      data.vehicleId,
      selectedIds,
    );
    const ids = data.full ? allIds : adminIds;

    const { data: rows, error } = await sb
      .from("concours_questions")
      .select("id, category, category_af, text_en, text_af, scoring_type, sort_order")
      .eq("active", true)
      .in("id", ids);
    if (error) throw new Error(error.message);
    return orderQuestionsByIds((rows ?? []) as ConcoursQuestion[], ids);
  });

/** Vehicle ids the caller has already scored (member session or device key). */
export const listMyConcoursScores = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        voterKey: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }): Promise<string[]> => {
    const authed = await createAuthedSupabaseFromRequest();
    if (authed) {
      const { data: rows } = await authed.supabase
        .from("event_concours_scores")
        .select("vehicle_id")
        .eq("event_id", data.eventId)
        .eq("user_id", authed.userId);
      if (rows?.length) return (rows as Array<{ vehicle_id: string }>).map((r) => r.vehicle_id);
    }
    if (!data.voterKey) return [];

    const fingerprint = await sha256Hex(`${data.eventId}:${data.voterKey}`);
    let reader: AnyClient;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      reader = supabaseAdmin as unknown as AnyClient;
    } catch {
      const { createPublicSupabase } = await import("./public-supabase.server");
      reader = createPublicSupabase() as unknown as AnyClient;
    }
    const { data: rows } = await reader
      .from("event_concours_scores")
      .select("vehicle_id")
      .eq("event_id", data.eventId)
      .eq("voter_fingerprint", fingerprint);
    return ((rows ?? []) as Array<{ vehicle_id: string }>).map((r) => r.vehicle_id);
  });

export const deleteConcoursVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ vehicleId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;
    await assertAdmin(sb, userId);

    const { error: scoreErr } = await sb
      .from("event_concours_scores")
      .delete()
      .eq("vehicle_id", data.vehicleId);
    if (scoreErr) throw new Error(scoreErr.message);

    const { error } = await sb.from("event_concours_vehicles").delete().eq("id", data.vehicleId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---------------------------------------------------------------------------
// Scoring — unsigned spectators (half questions, 0.5 weight); signed-in club members full + 1.0
// ---------------------------------------------------------------------------

export const submitConcoursScore = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        vehicleId: z.string().uuid(),
        answers: z.record(z.union([z.number(), z.string(), z.null()])),
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
        voterKey: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const publicSb = createPublicSupabase() as unknown as AnyClient;

    const ev = await assertScoringOpen(publicSb, data.eventId);

    const { data: ec } = await publicSb
      .from("event_concours")
      .select("selected_question_ids, enabled, results_published_at")
      .eq("event_id", data.eventId)
      .maybeSingle();
    if (!ec?.enabled) throw new Error("Concours is not enabled for this event");
    if (ec.results_published_at) throw new Error("Scoring is closed — results are already published.");

    const { data: veh } = await publicSb
      .from("event_concours_vehicles")
      .select("id, event_id")
      .eq("id", data.vehicleId)
      .maybeSingle();
    if (!veh || veh.event_id !== data.eventId) throw new Error("Vehicle is not part of this event.");

    const selectedIds: string[] = (ec.selected_question_ids as string[]) ?? [];
    if (selectedIds.length === 0) throw new Error("No questions configured");

    const authed = await createAuthedSupabaseFromRequest();
    let clubMember = false;
    if (authed) {
      const { data: profile } = await authed.supabase
        .from("profiles")
        .select("membership_status")
        .eq("id", authed.userId)
        .maybeSingle();
      clubMember = isClubMemberStatus(profile?.membership_status as string | undefined);
    }

    let memberCheckedIn = false;
    if (clubMember && authed) {
      const { data: cin } = await authed.supabase
        .from("event_checkins")
        .select("id, is_spectator")
        .eq("event_id", data.eventId)
        .eq("user_id", authed.userId)
        .maybeSingle();
      memberCheckedIn = !!cin && !cin.is_spectator;
    }

    if (clubMember && authed && memberCheckedIn) {
      const { allIds } = await questionIdsForVehicle(
        publicSb,
        data.eventId,
        data.vehicleId,
        selectedIds,
      );
      const allowedIds = allIds;
      assertAllQuestionsAnswered(data.answers, allowedIds);
      const { totalScore } = scoreAnswers(data.answers, allowedIds);

      const payload = {
        event_id: data.eventId,
        vehicle_id: data.vehicleId,
        user_id: authed.userId,
        is_member: true,
        weight: 1.0,
        answers: data.answers,
        total_score: totalScore,
        voter_fingerprint: null,
        submitted_at: new Date().toISOString(),
      };
      let writer: AnyClient = authed.supabase;
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        writer = supabaseAdmin as unknown as AnyClient;
      } catch {
        writer = authed.supabase;
      }
      await upsertScoreRow(writer, payload, "member");
      return { ok: true as const, totalScore, isMember: true, weight: 1.0 };
    }

    if (data.lat == null || data.lng == null) {
      throw new Error("Location is required to score as a spectator.");
    }
    if (!data.voterKey) {
      throw new Error("Missing spectator vote key — refresh and try again.");
    }
    assertWithinVenue(data.lat, data.lng, ev.destination_lat, ev.destination_lng);

    const allowedIds = spectatorQuestionIds(selectedIds);
    assertAllQuestionsAnswered(data.answers, allowedIds);
    const { totalScore } = scoreAnswers(data.answers, allowedIds);
    const fingerprint = await sha256Hex(`${data.eventId}:${data.voterKey}`);

    let writer: AnyClient = publicSb;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      writer = supabaseAdmin as unknown as AnyClient;
    } catch {
      writer = publicSb;
    }

    const payload = {
      event_id: data.eventId,
      vehicle_id: data.vehicleId,
      user_id: null,
      is_member: false,
      weight: 0.5,
      answers: data.answers,
      total_score: totalScore,
      voter_fingerprint: fingerprint,
      submitted_at: new Date().toISOString(),
    };
    await upsertScoreRow(writer, payload, "spectator");
    return { ok: true as const, totalScore, isMember: false, weight: 0.5 };
  });


export const tagConcoursVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        vehicleId: z.string().uuid(),
        taggedUserId: z.string().uuid().nullable(),
        taggedDisplayName: z.string().nullable().optional(),
        taggedMemberNumber: z.number().int().nullable().optional(),
        garageVehicleId: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;

    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (data.taggedUserId && data.taggedUserId !== userId && !isAdmin) {
      throw new Error("Only club admins can tag another member's car");
    }

    const payload: Record<string, unknown> = {
      tagged_user_id: data.taggedUserId,
      tagged_display_name: data.taggedDisplayName ?? null,
      tagged_member_number: data.taggedMemberNumber ?? null,
    };
    if (data.garageVehicleId !== undefined) {
      payload.garage_vehicle_id = data.garageVehicleId;
    }
    const { error } = await sb
      .from("event_concours_vehicles")
      .update(payload)
      .eq("id", data.vehicleId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Member links a concours car to one of their garage entries (and tags themselves). */
export const linkConcoursToGarage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        concoursVehicleId: z.string().uuid(),
        garageVehicleId: z.string().uuid().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;

    const { data: profile } = await sb
      .from("profiles")
      .select("display_name, member_number")
      .eq("id", userId)
      .maybeSingle();

    let garageLabel: string | null = null;
    if (data.garageVehicleId) {
      const { data: gv } = await sb
        .from("garage_vehicles")
        .select("id, user_id, make, model, year, nickname")
        .eq("id", data.garageVehicleId)
        .maybeSingle();
      if (!gv) throw new Error("Garage vehicle not found");
      // Owner or admin only
      const { data: isAdmin } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (gv.user_id !== userId && !isAdmin) {
        throw new Error("You can only link your own garage vehicles");
      }
      garageLabel =
        (gv.nickname as string) ||
        [gv.year, gv.make, gv.model].filter(Boolean).join(" ") ||
        null;
    }

    const { error } = await sb
      .from("event_concours_vehicles")
      .update({
        garage_vehicle_id: data.garageVehicleId,
        tagged_user_id: data.garageVehicleId ? userId : null,
        tagged_display_name: data.garageVehicleId
          ? ((profile?.display_name as string | null) ?? null)
          : null,
        tagged_member_number: data.garageVehicleId
          ? ((profile?.member_number as number | null) ?? null)
          : null,
        label: garageLabel,
      })
      .eq("id", data.concoursVehicleId);
    if (error) throw new Error(error.message);
    return { ok: true as const, garageLabel };
  });

export type MyGaragePick = {
  id: string;
  label: string;
  year: number | null;
  make: string | null;
  model: string | null;
  nickname: string | null;
};

export const listMyGaragePicks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyGaragePick[]> => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;
    const { data, error } = await sb
      .from("garage_vehicles")
      .select("id, make, model, year, nickname")
      .eq("user_id", userId)
      .order("sort", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((g: Record<string, unknown>) => ({
      id: g.id as string,
      year: (g.year as number | null) ?? null,
      make: (g.make as string | null) ?? null,
      model: (g.model as string | null) ?? null,
      nickname: (g.nickname as string | null) ?? null,
      label:
        (g.nickname as string) ||
        [g.year, g.make, g.model].filter(Boolean).join(" ") ||
        "Vehicle",
    }));
  });


// ---------------------------------------------------------------------------
// Location check-in (must be near event destination to score / add cars)
// ---------------------------------------------------------------------------

export type CheckInStatus = {
  checkedIn: boolean;
  isSpectator: boolean;
  checkedInAt: string | null;
  distanceM: number | null;
  radiusM: number;
  destinationLat: number | null;
  destinationLng: number | null;
};

export const getMyEventCheckIn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ eventId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<CheckInStatus> => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;

    const { data: ev } = await sb
      .from("events")
      .select("destination_lat, destination_lng")
      .eq("id", data.eventId)
      .maybeSingle();

    const { data: row } = await sb
      .from("event_checkins")
      .select("checked_in_at, distance_m, is_spectator")
      .eq("event_id", data.eventId)
      .eq("user_id", userId)
      .maybeSingle();

    return {
      checkedIn: !!row,
      isSpectator: Boolean(row?.is_spectator),
      checkedInAt: (row?.checked_in_at as string | null) ?? null,
      distanceM: row ? Number(row.distance_m) : null,
      radiusM: CHECKIN_RADIUS_M,
      destinationLat:
        ev?.destination_lat != null && Number.isFinite(Number(ev.destination_lat))
          ? Number(ev.destination_lat)
          : null,
      destinationLng:
        ev?.destination_lng != null && Number.isFinite(Number(ev.destination_lng))
          ? Number(ev.destination_lng)
          : null,
    };
  });

export const checkInToEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        isSpectator: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;

    const ev = await assertScoringOpen(sb, data.eventId);
    const distanceM = assertWithinVenue(
      data.lat,
      data.lng,
      ev.destination_lat,
      ev.destination_lng,
    );

    const { error } = await sb.from("event_checkins").upsert(
      {
        event_id: data.eventId,
        user_id: userId,
        lat: data.lat,
        lng: data.lng,
        distance_m: distanceM,
        is_spectator: false,
        checked_in_at: new Date().toISOString(),
      },
      { onConflict: "event_id,user_id" },
    );
    if (error) throw new Error(error.message);

    return { ok: true as const, distanceM, radiusM: CHECKIN_RADIUS_M };
  });


// ---------------------------------------------------------------------------
// Admin: question bank
// ---------------------------------------------------------------------------

export const listAllConcoursQuestionsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConcoursQuestion[]> => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;
    await assertAdmin(sb, userId);
    const { data, error } = await sb
      .from("concours_questions")
      .select("id, category, category_af, text_en, text_af, scoring_type, sort_order, active")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as ConcoursQuestion[];
  });

export const upsertConcoursQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        category: z.string().min(1).max(80),
        categoryAf: z.string().max(80).nullable().optional(),
        textEn: z.string().min(1).max(400),
        textAf: z.string().min(1).max(400),
        scoringType: z.enum(["scale_1_10", "yes_no", "yes_no_na", "count"]),
        sortOrder: z.number().int().min(0).max(9999).optional(),
        active: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;
    await assertAdmin(sb, userId);

    const payload = {
      category: data.category,
      category_af: data.categoryAf ?? null,
      text_en: data.textEn,
      text_af: data.textAf,
      scoring_type: data.scoringType,
      sort_order: data.sortOrder ?? 0,
      active: data.active ?? true,
    };

    if (data.id) {
      const { error } = await sb.from("concours_questions").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true as const, id: data.id };
    }
    const { data: row, error } = await sb
      .from("concours_questions")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: row.id as string };
  });

// ---------------------------------------------------------------------------
// Publish results to home
// ---------------------------------------------------------------------------

export const publishConcoursResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        winnerVehicleId: z.string().uuid().nullable(),
        winnerPhotoUrl: z.string().url().nullable(),
        winnerHeadlineEn: z.string().max(200).nullable().optional(),
        winnerHeadlineAf: z.string().max(200).nullable().optional(),
        resultsOnHome: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;
    await assertAdmin(sb, userId);

    let winnerAverage: number | null = null;
    let winnerCount = 0;
    if (data.winnerVehicleId) {
      const { data: scores } = await sb
        .from("event_concours_scores")
        .select("total_score, weight")
        .eq("vehicle_id", data.winnerVehicleId);
      const stats = weightedAverage(scores ?? []);
      winnerAverage = stats.average;
      winnerCount = stats.count;
    }

    const { error } = await sb
      .from("event_concours")
      .update({
        winner_vehicle_id: data.winnerVehicleId,
        winner_photo_url: data.winnerPhotoUrl,
        winner_headline_en: data.winnerHeadlineEn ?? null,
        winner_headline_af: data.winnerHeadlineAf ?? null,
        winner_average_score: winnerAverage,
        winner_submission_count: winnerCount,
        results_on_home: data.resultsOnHome,
        results_published_at: data.resultsOnHome ? new Date().toISOString() : null,
        leaderboard_revealed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("event_id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export type ConcoursHomeWinner = {
  eventId: string;
  eventTitle: string;
  eventTitleAf: string | null;
  eventStartsAt: string;
  winnerPhotoUrl: string;
  winnerHeadlineEn: string | null;
  winnerHeadlineAf: string | null;
  vehicleLabel: string | null;
  taggedDisplayName: string | null;
  averageScore: number | null;
  submissionCount: number;
  prizeEn: string | null;
  prizeAf: string | null;
};

export const getLatestConcoursHomeWinner = createServerFn({ method: "GET" }).handler(
  async (): Promise<ConcoursHomeWinner | null> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const supabase = createPublicSupabase() as unknown as AnyClient;

    const { data: ec, error } = await supabase
      .from("event_concours")
      .select(
        "event_id, winner_vehicle_id, winner_photo_url, winner_headline_en, winner_headline_af, prize_en, prize_af, results_published_at, winner_average_score, winner_submission_count",
      )
      .eq("results_on_home", true)
      .not("winner_photo_url", "is", null)
      .order("results_published_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ec?.winner_photo_url) return null;

    const { data: ev } = await supabase
      .from("events")
      .select("id, title, title_af, starts_at")
      .eq("id", ec.event_id)
      .maybeSingle();
    if (!ev) return null;

    let vehicleLabel: string | null = null;
    let taggedDisplayName: string | null = null;
    let averageScore: number | null =
      ec.winner_average_score == null ? null : Number(ec.winner_average_score);
    let submissionCount = Number(ec.winner_submission_count ?? 0);

    if (ec.winner_vehicle_id) {
      const { data: v } = await supabase
        .from("event_concours_vehicles")
        .select("label, tagged_display_name")
        .eq("id", ec.winner_vehicle_id)
        .maybeSingle();
      vehicleLabel = (v?.label as string | null) ?? null;
      taggedDisplayName = (v?.tagged_display_name as string | null) ?? null;

      if (averageScore == null) {
        const { data: scores } = await supabase
          .from("event_concours_scores")
          .select("total_score, weight")
          .eq("vehicle_id", ec.winner_vehicle_id);
        const stats = weightedAverage(scores ?? []);
        averageScore = stats.average;
        submissionCount = stats.count;
      }
    }

    return {
      eventId: ev.id as string,
      eventTitle: ev.title as string,
      eventTitleAf: (ev.title_af as string | null) ?? null,
      eventStartsAt: ev.starts_at as string,
      winnerPhotoUrl: ec.winner_photo_url as string,
      winnerHeadlineEn: (ec.winner_headline_en as string | null) ?? null,
      winnerHeadlineAf: (ec.winner_headline_af as string | null) ?? null,
      vehicleLabel,
      taggedDisplayName,
      averageScore,
      submissionCount,
      prizeEn: (ec.prize_en as string | null) ?? null,
      prizeAf: (ec.prize_af as string | null) ?? null,
    };
  },
);

/** Alias used by Lovable fix — same as getLatestConcoursHomeWinner */


// ---------------------------------------------------------------------------
// Admin: individual score management
// ---------------------------------------------------------------------------

export type ConcoursScoreRow = {
  id: string;
  event_id: string;
  vehicle_id: string;
  user_id: string | null;
  is_member: boolean;
  weight: number;
  total_score: number | null;
  answers: Record<string, number | string | null>;
  submitted_at: string | null;
  display_name: string | null;
  member_number: number | null;
  vehicle_label: string | null;
};

export const listConcoursScoresAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ eventId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<ConcoursScoreRow[]> => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;
    await assertAdmin(sb, userId);

    const { data: scores, error } = await sb
      .from("event_concours_scores")
      .select("id, event_id, vehicle_id, user_id, is_member, weight, total_score, answers, submitted_at")
      .eq("event_id", data.eventId)
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!scores?.length) return [];

    const userIds = [...new Set(scores.map((s: { user_id: string | null }) => s.user_id).filter(Boolean))] as string[];
    const vehicleIds = [...new Set(scores.map((s: { vehicle_id: string }) => s.vehicle_id))];

    const [{ data: profiles }, { data: vehicles }] = await Promise.all([
      userIds.length
        ? sb.from("profiles").select("id, display_name, member_number").in("id", userIds)
        : Promise.resolve({ data: [] }),
      sb
        .from("event_concours_vehicles")
        .select("id, label, tagged_display_name")
        .in("id", vehicleIds),
    ]);

    const byUser = new Map<string, Record<string, unknown>>(
      ((profiles ?? []) as Record<string, unknown>[]).map((p) => [p.id as string, p]),
    );
    const byVeh = new Map<string, Record<string, unknown>>(
      ((vehicles ?? []) as Record<string, unknown>[]).map((v) => [v.id as string, v]),
    );

    return scores.map((s: Record<string, unknown>) => {
      const p = s.user_id ? byUser.get(s.user_id as string) : null;
      const v = byVeh.get(s.vehicle_id as string);
      return {
        id: s.id as string,
        event_id: s.event_id as string,
        vehicle_id: s.vehicle_id as string,
        user_id: (s.user_id as string | null) ?? null,
        is_member: Boolean(s.is_member),
        weight: Number(s.weight) || 1,
        total_score: s.total_score == null ? null : Number(s.total_score),
        answers: (s.answers as Record<string, number | string | null>) ?? {},
        submitted_at: (s.submitted_at as string | null) ?? null,
        display_name: (p?.display_name as string | null) ?? null,
        member_number: (p?.member_number as number | null) ?? null,
        vehicle_label:
          ((v?.tagged_display_name as string | null) || (v?.label as string | null)) ?? null,
      };
    });
  });

export const updateConcoursScoreAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        scoreId: z.string().uuid(),
        totalScore: z.number().min(0).max(10).nullable().optional(),
        weight: z.number().min(0).max(2).optional(),
        answers: z.record(z.union([z.number(), z.string(), z.null()])).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;
    await assertAdmin(sb, userId);

    const patch: Record<string, unknown> = {};
    if (data.totalScore !== undefined) patch.total_score = data.totalScore;
    if (data.weight !== undefined) patch.weight = data.weight;
    if (data.answers !== undefined) {
      patch.answers = data.answers;
      // Recompute total if answers provided and total not explicitly set
      if (data.totalScore === undefined) {
        let sum = 0;
        let count = 0;
        for (const val of Object.values(data.answers)) {
          if (typeof val === "number" && !Number.isNaN(val)) {
            sum += Math.max(0, Math.min(10, val));
            count += 1;
          } else if (val === "yes") {
            sum += 10;
            count += 1;
          } else if (val === "no") {
            count += 1;
          }
        }
        patch.total_score = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
      }
    }
    if (Object.keys(patch).length === 0) return { ok: true as const };

    const { error } = await sb.from("event_concours_scores").update(patch).eq("id", data.scoreId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteConcoursScoreAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ scoreId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as AnyClient;
    await assertAdmin(sb, userId);
    const { error } = await sb.from("event_concours_scores").delete().eq("id", data.scoreId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getLatestConcoursWinner = getLatestConcoursHomeWinner;
