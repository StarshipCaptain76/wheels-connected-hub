import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient } from "@/integrations/supabase/client.server";
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickBalancedQuestions(
  all: ConcoursQuestion[],
  count: number,
): ConcoursQuestion[] {
  const byCat = new Map<string, ConcoursQuestion[]>();
  for (const q of all) {
    const list = byCat.get(q.category) ?? [];
    list.push(q);
    byCat.set(q.category, list);
  }

  // Shuffle each category
  for (const list of byCat.values()) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }

  const categories = Array.from(byCat.keys());
  const selected: ConcoursQuestion[] = [];
  let catIdx = 0;

  while (selected.length < count && categories.length > 0) {
    const cat = categories[catIdx % categories.length];
    const list = byCat.get(cat)!;
    if (list.length > 0) {
      selected.push(list.shift()!);
    } else {
      categories.splice(catIdx % categories.length, 1);
      continue;
    }
    catIdx++;
  }

  return selected;
}

// ---------------------------------------------------------------------------
// Public / shared reads
// ---------------------------------------------------------------------------

export const getEventConcours = createServerFn({ method: "GET" })
  .validator(z.object({ eventId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    const { data: row, error } = await supabase
      .from("event_concours")
      .select("*")
      .eq("event_id", data.eventId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return row as EventConcours | null;
  });

export const listConcoursQuestions = createServerFn({ method: "GET" })
  .validator(z.object({ ids: z.array(z.string().uuid()).optional() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    let q = supabase
      .from("concours_questions")
      .select("id, category, category_af, text_en, text_af, scoring_type, sort_order")
      .eq("active", true)
      .order("sort_order");

    if (data.ids && data.ids.length > 0) {
      q = q.in("id", data.ids);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ConcoursQuestion[];
  });

export const listConcoursVehicles = createServerFn({ method: "GET" })
  .validator(z.object({ eventId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();

    const { data: vehicles, error } = await supabase
      .from("event_concours_vehicles")
      .select("*")
      .eq("event_id", data.eventId)
      .order("sort_order");

    if (error) throw new Error(error.message);
    if (!vehicles?.length) return [] as ConcoursVehicle[];

    // Compute live weighted averages
    const { data: scores } = await supabase
      .from("event_concours_scores")
      .select("vehicle_id, total_score, weight, is_member")
      .eq("event_id", data.eventId);

    const byVehicle = new Map<
      string,
      { weightedSum: number; weightSum: number; count: number }
    >();

    for (const s of scores ?? []) {
      if (s.total_score == null) continue;
      const cur = byVehicle.get(s.vehicle_id) ?? {
        weightedSum: 0,
        weightSum: 0,
        count: 0,
      };
      const w = Number(s.weight) || 1;
      cur.weightedSum += Number(s.total_score) * w;
      cur.weightSum += w;
      cur.count += 1;
      byVehicle.set(s.vehicle_id, cur);
    }

    return vehicles.map((v) => {
      const stats = byVehicle.get(v.id);
      return {
        ...v,
        average_score:
          stats && stats.weightSum > 0
            ? Math.round((stats.weightedSum / stats.weightSum) * 10) / 10
            : null,
        submission_count: stats?.count ?? 0,
      } as ConcoursVehicle;
    });
  });

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------

export const upsertEventConcours = createServerFn({ method: "POST" })
  .validator(
    z.object({
      eventId: z.string().uuid(),
      enabled: z.boolean(),
      questionCount: z.number().int().min(5).max(15),
      prizeEn: z.string().nullable().optional(),
      prizeAf: z.string().nullable().optional(),
      sponsorName: z.string().nullable().optional(),
      sponsorLogoUrl: z.string().nullable().optional(),
      reRollQuestions: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _role: "admin",
      _user_id: user.id,
    });
    if (!isAdmin) throw new Error("Admin only");

    const { data: existing } = await supabase
      .from("event_concours")
      .select("*")
      .eq("event_id", data.eventId)
      .maybeSingle();

    let selectedIds: string[] = existing?.selected_question_ids ?? [];

    // (Re)select questions if first time, count changed, or admin requested re-roll
    if (
      !existing ||
      data.reRollQuestions ||
      selectedIds.length !== data.questionCount
    ) {
      const { data: allQ } = await supabase
        .from("concours_questions")
        .select(
          "id, category, category_af, text_en, text_af, scoring_type, sort_order",
        )
        .eq("active", true);

      const picked = pickBalancedQuestions(
        (allQ ?? []) as ConcoursQuestion[],
        data.questionCount,
      );
      selectedIds = picked.map((q) => q.id);
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

    const { error } = await supabase
      .from("event_concours")
      .upsert(payload, { onConflict: "event_id" });

    if (error) throw new Error(error.message);
    return { ok: true, selectedCount: selectedIds.length };
  });

export const revealConcoursLeaderboard = createServerFn({ method: "POST" })
  .validator(z.object({ eventId: z.string().uuid(), revealed: z.boolean() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _role: "admin",
      _user_id: user.id,
    });
    if (!isAdmin) throw new Error("Admin only");

    const { error } = await supabase
      .from("event_concours")
      .update({
        leaderboard_revealed: data.revealed,
        updated_at: new Date().toISOString(),
      })
      .eq("event_id", data.eventId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addConcoursVehicle = createServerFn({ method: "POST" })
  .validator(
    z.object({
      eventId: z.string().uuid(),
      photoUrl: z.string().url(),
      label: z.string().nullable().optional(),
      labelAf: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _role: "admin",
      _user_id: user.id,
    });
    if (!isAdmin) throw new Error("Admin only");

    const { count } = await supabase
      .from("event_concours_vehicles")
      .select("*", { count: "exact", head: true })
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
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row as ConcoursVehicle;
  });

export const deleteConcoursVehicle = createServerFn({ method: "POST" })
  .validator(z.object({ vehicleId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _role: "admin",
      _user_id: user.id,
    });
    if (!isAdmin) throw new Error("Admin only");

    const { error } = await supabase
      .from("event_concours_vehicles")
      .delete()
      .eq("id", data.vehicleId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export const submitConcoursScore = createServerFn({ method: "POST" })
  .validator(
    z.object({
      eventId: z.string().uuid(),
      vehicleId: z.string().uuid(),
      answers: z.record(z.union([z.number(), z.string(), z.null()])),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let isMember = false;
    let weight = 0.5; // public default

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("membership_status")
        .eq("id", user.id)
        .maybeSingle();

      isMember =
        profile?.membership_status === "active" ||
        profile?.membership_status === "member";
      weight = isMember ? 1.0 : 0.5;
    }

    const { data: ec } = await supabase
      .from("event_concours")
      .select("selected_question_ids, enabled")
      .eq("event_id", data.eventId)
      .maybeSingle();

    if (!ec?.enabled) throw new Error("Concours is not enabled for this event");

    const selectedIds: string[] = ec.selected_question_ids ?? [];
    if (selectedIds.length === 0) throw new Error("No questions configured");

    // Public users only answer 50 % of the questions
    let allowedIds = selectedIds;
    if (!isMember) {
      const half = Math.ceil(selectedIds.length / 2);
      allowedIds = selectedIds.slice(0, half);
    }

    let sum = 0;
    let count = 0;
    for (const [qid, val] of Object.entries(data.answers)) {
      if (!allowedIds.includes(qid)) continue;
      if (typeof val === "number" && !Number.isNaN(val)) {
        sum += val;
        count += 1;
      } else if (val === "yes" || val === true) {
        sum += 10;
        count += 1;
      } else if (val === "no" || val === false) {
        sum += 0;
        count += 1;
      }
      // N/A skipped
    }

    const totalScore = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;

    const payload = {
      event_id: data.eventId,
      vehicle_id: data.vehicleId,
      user_id: user?.id ?? null,
      is_member: isMember,
      weight,
      answers: data.answers,
      total_score: totalScore,
      submitted_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("event_concours_scores")
      .upsert(payload, {
        onConflict: "event_id,vehicle_id,user_id",
      });

    if (error) throw new Error(error.message);
    return { ok: true, totalScore, isMember, weight };
  });
