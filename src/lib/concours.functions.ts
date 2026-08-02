import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
};

export type ConcoursVehicle = {
  id: string;
  event_id: string;
  label: string | null;
  label_af: string | null;
  photo_url: string;
  sort_order: number;
  average_score?: number | null;
  submission_count?: number;
};

export type ConcoursAnswer = number | string | null;

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

export const getEventConcours = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ eventId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<EventConcours | null> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const supabase = createPublicSupabase();
    const { data: row, error } = await supabase
      .from("event_concours")
      .select(
        "event_id, enabled, question_count, selected_question_ids, prize_en, prize_af, sponsor_name, sponsor_logo_url, leaderboard_revealed",
      )
      .eq("event_id", data.eventId)
      .maybeSingle();
    if (error) {
      console.error("getEventConcours", error);
      return null;
    }
    return (row ?? null) as EventConcours | null;
  });

export const listConcoursQuestions = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).optional() }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<ConcoursQuestion[]> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const supabase = createPublicSupabase();
    let q = supabase
      .from("concours_questions")
      .select("id, category, category_af, text_en, text_af, scoring_type, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (data.ids && data.ids.length > 0) q = q.in("id", data.ids);
    const { data: rows, error } = await q;
    if (error) {
      console.error("listConcoursQuestions", error);
      return [];
    }
    return (rows ?? []) as ConcoursQuestion[];
  });

export const listConcoursVehicles = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ eventId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<ConcoursVehicle[]> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const supabase = createPublicSupabase();

    const { data: vehicles, error } = await supabase
      .from("event_concours_vehicles")
      .select("id, event_id, label, label_af, photo_url, sort_order")
      .eq("event_id", data.eventId)
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("listConcoursVehicles", error);
      return [];
    }
    if (!vehicles?.length) return [];

    const { data: scores } = await supabase
      .from("event_concours_scores")
      .select("vehicle_id, total_score, weight")
      .eq("event_id", data.eventId);

    const byVehicle = new Map<string, { weightedSum: number; weightSum: number; count: number }>();
    for (const s of scores ?? []) {
      if (s.total_score == null) continue;
      const cur = byVehicle.get(s.vehicle_id as string) ?? {
        weightedSum: 0,
        weightSum: 0,
        count: 0,
      };
      const w = Number(s.weight) || 1;
      cur.weightedSum += Number(s.total_score) * w;
      cur.weightSum += w;
      cur.count += 1;
      byVehicle.set(s.vehicle_id as string, cur);
    }

    const { signStoredUrls } = await import("./storage-urls.server");
    const signed = await signStoredUrls(
      supabase,
      vehicles.map((v) => v.photo_url as string),
    );

    return vehicles.map((v) => {
      const stats = byVehicle.get(v.id as string);
      return {
        id: v.id as string,
        event_id: v.event_id as string,
        label: (v.label as string) ?? null,
        label_af: (v.label_af as string) ?? null,
        photo_url: signed.get(v.photo_url as string) ?? (v.photo_url as string),
        sort_order: (v.sort_order as number) ?? 0,
        average_score:
          stats && stats.weightSum > 0
            ? Math.round((stats.weightedSum / stats.weightSum) * 10) / 10
            : null,
        submission_count: stats?.count ?? 0,
      };
    });
  });

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------

function pickBalancedQuestions(all: ConcoursQuestion[], count: number): ConcoursQuestion[] {
  const byCat = new Map<string, ConcoursQuestion[]>();
  for (const q of all) {
    const list = byCat.get(q.category) ?? [];
    list.push(q);
    byCat.set(q.category, list);
  }
  for (const list of byCat.values()) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  const cats = [...byCat.keys()];
  const selected: ConcoursQuestion[] = [];
  let round = 0;
  while (selected.length < count && cats.length > 0) {
    let added = false;
    for (const c of cats) {
      const list = byCat.get(c)!;
      if (list.length > round) {
        selected.push(list[round]);
        added = true;
        if (selected.length === count) break;
      }
    }
    if (!added) break;
    round += 1;
  }
  return selected.slice(0, count);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export const upsertEventConcours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        enabled: z.boolean(),
        questionCount: z.number().int().min(5).max(15),
        prizeEn: z.string().trim().max(300).nullable().optional(),
        prizeAf: z.string().trim().max(300).nullable().optional(),
        sponsorName: z.string().trim().max(120).nullable().optional(),
        sponsorLogoUrl: z.string().trim().max(1000).nullable().optional(),
        reRollQuestions: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: existing } = await supabase
      .from("event_concours")
      .select("event_id, selected_question_ids")
      .eq("event_id", data.eventId)
      .maybeSingle();

    let selectedIds: string[] = (existing?.selected_question_ids as string[]) ?? [];

    if (!existing || data.reRollQuestions || selectedIds.length !== data.questionCount) {
      const { data: allQ } = await supabase
        .from("concours_questions")
        .select("id, category, category_af, text_en, text_af, scoring_type, sort_order")
        .eq("active", true);
      selectedIds = pickBalancedQuestions(
        (allQ ?? []) as ConcoursQuestion[],
        data.questionCount,
      ).map((q) => q.id);
    }

    const { error } = await supabase.from("event_concours").upsert(
      {
        event_id: data.eventId,
        enabled: data.enabled,
        question_count: data.questionCount,
        selected_question_ids: selectedIds,
        prize_en: data.prizeEn ?? null,
        prize_af: data.prizeAf ?? null,
        sponsor_name: data.sponsorName ?? null,
        sponsor_logo_url: data.sponsorLogoUrl ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id" },
    );
    if (error) throw error;
    return { ok: true, selectedCount: selectedIds.length };
  });

export const revealConcoursLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ eventId: z.string().uuid(), revealed: z.boolean() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("event_concours")
      .update({ leaderboard_revealed: data.revealed, updated_at: new Date().toISOString() })
      .eq("event_id", data.eventId);
    if (error) throw error;
    return { ok: true };
  });

export const addConcoursVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        photoUrl: z.string().trim().min(1).max(1000),
        label: z.string().trim().max(120).nullable().optional(),
        labelAf: z.string().trim().max(120).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { count } = await supabase
      .from("event_concours_vehicles")
      .select("id", { count: "exact", head: true })
      .eq("event_id", data.eventId);

    const { data: row, error } = await supabase
      .from("event_concours_vehicles")
      .insert({
        event_id: data.eventId,
        photo_url: data.photoUrl,
        label: data.label ?? null,
        label_af: data.labelAf ?? null,
        sort_order: count ?? 0,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id as string };
  });

export const deleteConcoursVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ vehicleId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("event_concours_vehicles")
      .delete()
      .eq("id", data.vehicleId);
    if (error) throw error;
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const answersSchema = z.record(z.string(), z.union([z.number(), z.string(), z.null()]));

function scoreAnswers(answers: Record<string, ConcoursAnswer>, allowedIds: string[]) {
  let sum = 0;
  let count = 0;
  for (const [qid, val] of Object.entries(answers)) {
    if (!allowedIds.includes(qid)) continue;
    if (typeof val === "number" && !Number.isNaN(val)) {
      sum += val;
      count += 1;
    } else if (val === "yes") {
      sum += 10;
      count += 1;
    } else if (val === "no") {
      count += 1;
    }
    // "na" / null skipped
  }
  return count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
}

/** Signed-in member vote — full question set, full weight. */
export const submitConcoursScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        vehicleId: z.string().uuid(),
        answers: answersSchema,
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_status")
      .eq("id", userId)
      .maybeSingle();
    const isMember =
      profile?.membership_status === "active" || profile?.membership_status === "member";
    const weight = isMember ? 1.0 : 0.5;

    const { data: ec } = await supabase
      .from("event_concours")
      .select("selected_question_ids, enabled")
      .eq("event_id", data.eventId)
      .maybeSingle();
    if (!ec?.enabled) throw new Error("Concours is not open for this event");

    const selectedIds = (ec.selected_question_ids as string[]) ?? [];
    if (selectedIds.length === 0) throw new Error("No questions configured");

    const allowedIds = isMember
      ? selectedIds
      : selectedIds.slice(0, Math.ceil(selectedIds.length / 2));
    const totalScore = scoreAnswers(data.answers, allowedIds);

    const { error } = await supabase.from("event_concours_scores").upsert(
      {
        event_id: data.eventId,
        vehicle_id: data.vehicleId,
        user_id: userId,
        is_member: isMember,
        weight,
        answers: data.answers,
        total_score: totalScore,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "event_id,vehicle_id,user_id" },
    );
    if (error) throw error;
    return { ok: true, totalScore, isMember, weight };
  });

export type ConcoursWinner = {
  eventId: string;
  eventTitle: string;
  eventTitleAf: string | null;
  eventDate: string | null;
  prizeEn: string | null;
  prizeAf: string | null;
  sponsorName: string | null;
  vehicleLabel: string | null;
  vehicleLabelAf: string | null;
  winnerPhotoUrl: string | null;
  winnerHeadlineEn: string | null;
  winnerHeadlineAf: string | null;
  taggedDisplayName: string | null;
  averageScore: number | null;
  submissionCount: number;
};

export const getLatestConcoursWinner = createServerFn({ method: "GET" }).handler(
  async (): Promise<ConcoursWinner | null> => {
    const { createPublicSupabase } = await import("./public-supabase.server");
    const supabase = createPublicSupabase();

    const { data: rows } = await supabase
      .from("event_concours")
      .select("event_id, prize_en, prize_af, sponsor_name, events!inner(title, title_af, start_at)")
      .eq("enabled", true)
      .eq("leaderboard_revealed", true)
      .order("start_at", { ascending: false, referencedTable: "events" })
      .limit(20);

    const list = (rows ?? []) as unknown as Array<{
      event_id: string;
      prize_en: string | null;
      prize_af: string | null;
      sponsor_name: string | null;
      events: { title: string; title_af: string | null; start_at: string | null };
    }>;
    if (!list.length) return null;
    list.sort((a, b) => (b.events?.start_at ?? "").localeCompare(a.events?.start_at ?? ""));
    const top = list[0];

    const vehicles = await listConcoursVehicles({ data: { eventId: top.event_id } });
    const ranked = vehicles
      .filter((v) => v.average_score != null)
      .sort((a, b) => (b.average_score ?? 0) - (a.average_score ?? 0));
    const winner = ranked[0];

    return {
      eventId: top.event_id,
      eventTitle: top.events?.title ?? "",
      eventTitleAf: top.events?.title_af ?? null,
      eventDate: top.events?.start_at ?? null,
      prizeEn: top.prize_en,
      prizeAf: top.prize_af,
      sponsorName: top.sponsor_name,
      vehicleLabel: winner?.label ?? null,
      vehicleLabelAf: winner?.label_af ?? null,
      winnerPhotoUrl: winner?.photo_url ?? null,
      winnerHeadlineEn: "Concours winner",
      winnerHeadlineAf: "Concours-wenner",
      taggedDisplayName: null,
      averageScore: winner?.average_score ?? null,
      submissionCount: winner?.submission_count ?? 0,
    };
  },
);
