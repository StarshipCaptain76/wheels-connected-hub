import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyClient = {
  from: (t: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
  auth?: any;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export type PollStatus = "draft" | "open" | "closed";
export type PollOptionSource = "admin" | "member";

export type HomePollOption = {
  id: string;
  label_en: string;
  label_af: string | null;
  vote_count: number;
  source: PollOptionSource;
};

export type HomePoll = {
  id: string;
  title_en: string;
  title_af: string | null;
  question_en: string;
  question_af: string | null;
  allow_member_options: boolean;
  my_vote_option_id: string | null;
  can_add_option: boolean;
  options: HomePollOption[];
};

export type AdminPollOption = HomePollOption & {
  hidden: boolean;
  sort_order: number;
  added_by: string | null;
  added_by_name: string | null;
};

export type AdminPoll = {
  id: string;
  title_en: string;
  title_af: string | null;
  question_en: string;
  question_af: string | null;
  status: PollStatus;
  show_on_home: boolean;
  allow_member_options: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  total_votes: number;
  options: AdminPollOption[];
};

const POLL_SELECT =
  "id, title_en, title_af, question_en, question_af, status, show_on_home, allow_member_options, sort_order, created_at, updated_at";

const OPTION_SELECT = "id, poll_id, label_en, label_af, source, added_by, hidden, sort_order";

async function assertAdmin(supabase: AnyClient, userId: string) {
  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(`Role check failed: ${error.message}`);
  if (!isAdmin) throw new Error("Forbidden");
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

function blank(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length ? t : null;
}

function normLabel(s: string): string {
  return s.trim().toLowerCase();
}

async function voteCounts(sb: AnyClient, pollIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (pollIds.length === 0) return map;
  const { data, error } = await sb.rpc("poll_option_vote_counts", { _poll_ids: pollIds });
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    map.set(String(row.option_id), Number(row.vote_count) || 0);
  }
  return map;
}

async function loadNames(sb: AnyClient, userIds: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return map;
  const { data } = await sb.from("profiles").select("id, display_name").in("id", ids);
  for (const row of data ?? []) {
    map.set(String(row.id), (row.display_name as string | null) ?? null);
  }
  return map;
}

function isDuplicate(label: string, options: Array<{ label_en: string; label_af: string | null }>): boolean {
  const n = normLabel(label);
  return options.some((o) => normLabel(o.label_en) === n || (o.label_af && normLabel(o.label_af) === n));
}

async function loadHomePolls(): Promise<HomePoll[]> {
  try {
      const { createPublicSupabase } = await import("./public-supabase.server");
      const { elevated } = await import("./elevated.server");
      const authed = await maybeAuthed();
      const anon = createPublicSupabase() as unknown as AnyClient;
      const sb = (await elevated(authed?.supabase ?? anon)) as AnyClient;

      const { data: polls, error } = await sb
        .from("polls")
        .select(POLL_SELECT)
        .eq("status", "open")
        .eq("show_on_home", true)
        .order("sort_order", { ascending: true })
        .limit(3);
      if (error) throw new Error(error.message);
      const rows = (polls ?? []) as Array<Record<string, unknown>>;
      if (rows.length === 0) return [];

      const pollIds = rows.map((p) => String(p.id));
      const { data: options, error: optErr } = await sb
        .from("poll_options")
        .select(OPTION_SELECT)
        .in("poll_id", pollIds)
        .eq("hidden", false)
        .order("sort_order", { ascending: true });
      if (optErr) throw new Error(optErr.message);

      const counts = await voteCounts(sb, pollIds);

      const myVote = new Map<string, string>();
      const myOptions = new Set<string>();
      if (authed) {
        const { data: votes } = await authed.supabase
          .from("poll_votes")
          .select("poll_id, option_id")
          .eq("user_id", authed.userId)
          .in("poll_id", pollIds);
        for (const v of votes ?? []) myVote.set(String(v.poll_id), String(v.option_id));

        const { data: mine } = await authed.supabase
          .from("poll_options")
          .select("poll_id")
          .eq("added_by", authed.userId)
          .eq("source", "member")
          .in("poll_id", pollIds);
        for (const o of mine ?? []) myOptions.add(String(o.poll_id));
      }

      const optsByPoll = new Map<string, HomePollOption[]>();
      for (const o of options ?? []) {
        const pid = String(o.poll_id);
        const list = optsByPoll.get(pid) ?? [];
        list.push({
          id: String(o.id),
          label_en: String(o.label_en ?? ""),
          label_af: (o.label_af as string | null) ?? null,
          vote_count: counts.get(String(o.id)) ?? 0,
          source: o.source === "member" ? "member" : "admin",
        });
        optsByPoll.set(pid, list);
      }

      return rows.map((p) => {
        const id = String(p.id);
        const opts = optsByPoll.get(id) ?? [];
        const allow = Boolean(p.allow_member_options);
        return {
          id,
          title_en: String(p.title_en ?? ""),
          title_af: (p.title_af as string | null) ?? null,
          question_en: String(p.question_en ?? ""),
          question_af: (p.question_af as string | null) ?? null,
          allow_member_options: allow,
          my_vote_option_id: myVote.get(id) ?? null,
          can_add_option: Boolean(authed) && allow && !myOptions.has(id) && opts.length < 20,
          options: opts,
        };
      });
  } catch (e) {
    console.error("[polls] home list failed (site continues)", e);
    return [];
  }
}

export const listHomePolls = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomePoll[]> => loadHomePolls(),
);

export const castVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ pollId: z.string().uuid(), optionId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }): Promise<HomePoll[]> => {
    const { supabase, userId } = context;
    const { elevated } = await import("./elevated.server");
    const sb = (await elevated(supabase)) as AnyClient;

    const { data: poll, error: pollErr } = await sb
      .from("polls")
      .select("id, status")
      .eq("id", data.pollId)
      .maybeSingle();
    if (pollErr) throw new Error(pollErr.message);
    if (!poll || poll.status !== "open") throw new Error("This poll is not open.");

    const { data: option, error: optErr } = await sb
      .from("poll_options")
      .select("id, poll_id, hidden")
      .eq("id", data.optionId)
      .maybeSingle();
    if (optErr) throw new Error(optErr.message);
    if (!option || option.poll_id !== data.pollId || option.hidden) {
      throw new Error("That option is not available.");
    }

    const now = new Date().toISOString();
    const { data: existing } = await sb
      .from("poll_votes")
      .select("id")
      .eq("poll_id", data.pollId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { error } = await sb
        .from("poll_votes")
        .update({ option_id: data.optionId, updated_at: now })
        .eq("id", existing.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("poll_votes").insert({
        poll_id: data.pollId,
        option_id: data.optionId,
        user_id: userId,
        updated_at: now,
      });
      if (error) throw new Error(error.message);
    }

    return loadHomePolls();
  });

export const addPollOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ pollId: z.string().uuid(), label: z.string().min(3).max(80) }).parse(i),
  )
  .handler(async ({ context, data }): Promise<HomePoll[]> => {
    const { supabase, userId } = context;
    const { elevated } = await import("./elevated.server");
    const sb = (await elevated(supabase)) as AnyClient;
    const label = data.label.trim();
    if (label.length < 3 || label.length > 80) throw new Error("Option must be 3–80 characters.");

    const { data: poll, error: pollErr } = await sb
      .from("polls")
      .select("id, status, allow_member_options")
      .eq("id", data.pollId)
      .maybeSingle();
    if (pollErr) throw new Error(pollErr.message);
    if (!poll || poll.status !== "open") throw new Error("This poll is not open.");
    if (!poll.allow_member_options) throw new Error("Members cannot add options to this poll.");

    const { data: options, error: optErr } = await sb
      .from("poll_options")
      .select("id, label_en, label_af, hidden, source, added_by, sort_order")
      .eq("poll_id", data.pollId);
    if (optErr) throw new Error(optErr.message);
    const all = (options ?? []) as Array<Record<string, unknown>>;
    const visible = all.filter((o) => !o.hidden);
    if (visible.length >= 20) throw new Error("This poll already has 20 options.");
    if (isDuplicate(label, all as Array<{ label_en: string; label_af: string | null }>)) {
      throw new Error("That option is already on this poll.");
    }
    if (all.some((o) => o.source === "member" && o.added_by === userId)) {
      throw new Error("You already added an option to this poll.");
    }

    const sort =
      all.length === 0 ? 10 : Math.max(...all.map((o) => Number(o.sort_order) || 0)) + 10;
    const { error } = await sb.from("poll_options").insert({
      poll_id: data.pollId,
      label_en: label,
      label_af: label,
      source: "member",
      added_by: userId,
      hidden: false,
      sort_order: sort,
    });
    if (error) {
      if (String(error.message).toLowerCase().includes("poll_options_label_uniq")) {
        throw new Error("That option is already on this poll.");
      }
      if (String(error.message).toLowerCase().includes("poll_options_one_member")) {
        throw new Error("You already added an option to this poll.");
      }
      throw new Error(error.message);
    }

    return loadHomePolls();
  });

async function hydrateAdmin(sb: AnyClient, row: Record<string, unknown>): Promise<AdminPoll> {
  const pollId = String(row.id);
  const { data: options, error } = await sb
    .from("poll_options")
    .select(OPTION_SELECT)
    .eq("poll_id", pollId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  const counts = await voteCounts(sb, [pollId]);
  const names = await loadNames(
    sb,
    (options ?? []).map((o: { added_by: string | null }) => o.added_by).filter(Boolean) as string[],
  );
  const adminOpts: AdminPollOption[] = (options ?? []).map((o: Record<string, unknown>) => ({
    id: String(o.id),
    label_en: String(o.label_en ?? ""),
    label_af: (o.label_af as string | null) ?? null,
    vote_count: counts.get(String(o.id)) ?? 0,
    source: o.source === "member" ? "member" : "admin",
    hidden: Boolean(o.hidden),
    sort_order: Number(o.sort_order) || 0,
    added_by: (o.added_by as string | null) ?? null,
    added_by_name: o.added_by ? (names.get(String(o.added_by)) ?? null) : null,
  }));
  const total = adminOpts.reduce((s, o) => s + o.vote_count, 0);
  return {
    id: pollId,
    title_en: String(row.title_en ?? ""),
    title_af: (row.title_af as string | null) ?? null,
    question_en: String(row.question_en ?? ""),
    question_af: (row.question_af as string | null) ?? null,
    status: (row.status as PollStatus) ?? "draft",
    show_on_home: Boolean(row.show_on_home),
    allow_member_options: Boolean(row.allow_member_options),
    sort_order: Number(row.sort_order) || 0,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    total_votes: total,
    options: adminOpts,
  };
}

export const adminListPolls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPoll[]> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as unknown as AnyClient, userId);
    const { elevated } = await import("./elevated.server");
    const sb = (await elevated(supabase)) as AnyClient;
    const { data, error } = await sb
      .from("polls")
      .select(POLL_SELECT)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const out: AdminPoll[] = [];
    for (const row of data ?? []) out.push(await hydrateAdmin(sb, row as Record<string, unknown>));
    return out;
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  titleEn: z.string().max(120),
  titleAf: z.string().max(120).nullable().optional(),
  questionEn: z.string().min(1).max(240),
  questionAf: z.string().max(240).nullable().optional(),
  allowMemberOptions: z.boolean().optional(),
  showOnHome: z.boolean().optional(),
  status: z.enum(["draft", "open", "closed"]).optional(),
  sortOrder: z.number().int().optional(),
  seedOptions: z
    .array(
      z.object({
        labelEn: z.string().min(1).max(80),
        labelAf: z.string().max(80).nullable().optional(),
      }),
    )
    .max(20)
    .optional(),
});

export const adminUpsertPoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => upsertSchema.parse(i))
  .handler(async ({ context, data }): Promise<AdminPoll> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as unknown as AnyClient, userId);
    const { elevated } = await import("./elevated.server");
    const sb = (await elevated(supabase)) as AnyClient;
    const now = new Date().toISOString();

    if (data.id) {
      const patch: Record<string, unknown> = {
        title_en: data.titleEn.trim(),
        title_af: blank(data.titleAf),
        question_en: data.questionEn.trim(),
        question_af: blank(data.questionAf),
        updated_at: now,
      };
      if (data.allowMemberOptions !== undefined) patch.allow_member_options = data.allowMemberOptions;
      if (data.showOnHome !== undefined) patch.show_on_home = data.showOnHome;
      if (data.status !== undefined) {
        patch.status = data.status;
        if (data.status === "closed") patch.show_on_home = false;
      }
      if (data.sortOrder !== undefined) patch.sort_order = data.sortOrder;
      const { error } = await sb.from("polls").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      const { data: row } = await sb.from("polls").select(POLL_SELECT).eq("id", data.id).single();
      return hydrateAdmin(sb, row as Record<string, unknown>);
    }

    const { data: inserted, error: insErr } = await sb
      .from("polls")
      .insert({
        title_en: data.titleEn.trim(),
        title_af: blank(data.titleAf),
        question_en: data.questionEn.trim(),
        question_af: blank(data.questionAf),
        allow_member_options: data.allowMemberOptions ?? true,
        show_on_home: data.status === "closed" ? false : Boolean(data.showOnHome),
        status: data.status ?? "draft",
        sort_order: data.sortOrder ?? 100,
        created_by: userId,
        updated_at: now,
      })
      .select(POLL_SELECT)
      .single();
    if (insErr) throw new Error(insErr.message);

    const seeds = data.seedOptions ?? [];
    for (let i = 0; i < seeds.length; i++) {
      const labelEn = seeds[i].labelEn.trim();
      if (!labelEn) continue;
      const { error } = await sb.from("poll_options").insert({
        poll_id: inserted.id,
        label_en: labelEn,
        label_af: blank(seeds[i].labelAf) ?? labelEn,
        source: "admin",
        hidden: false,
        sort_order: (i + 1) * 10,
      });
      if (error) throw new Error(error.message);
    }

    const { data: row } = await sb.from("polls").select(POLL_SELECT).eq("id", inserted.id).single();
    return hydrateAdmin(sb, row as Record<string, unknown>);
  });

export const adminSetPollStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["draft", "open", "closed"]) }).parse(i),
  )
  .handler(async ({ context, data }): Promise<AdminPoll> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as unknown as AnyClient, userId);
    const { elevated } = await import("./elevated.server");
    const sb = (await elevated(supabase)) as AnyClient;
    const patch: Record<string, unknown> = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.status === "closed") patch.show_on_home = false;
    const { error } = await sb.from("polls").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    const { data: row } = await sb.from("polls").select(POLL_SELECT).eq("id", data.id).single();
    return hydrateAdmin(sb, row as Record<string, unknown>);
  });

export const adminSetPollHome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), showOnHome: z.boolean() }).parse(i),
  )
  .handler(async ({ context, data }): Promise<AdminPoll> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as unknown as AnyClient, userId);
    const { elevated } = await import("./elevated.server");
    const sb = (await elevated(supabase)) as AnyClient;
    const { error } = await sb
      .from("polls")
      .update({ show_on_home: data.showOnHome, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    const { data: row } = await sb.from("polls").select(POLL_SELECT).eq("id", data.id).single();
    return hydrateAdmin(sb, row as Record<string, unknown>);
  });

export const adminAddPollOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        pollId: z.string().uuid(),
        labelEn: z.string().min(1).max(80),
        labelAf: z.string().max(80).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }): Promise<AdminPoll> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as unknown as AnyClient, userId);
    const { elevated } = await import("./elevated.server");
    const sb = (await elevated(supabase)) as AnyClient;
    const { data: options } = await sb
      .from("poll_options")
      .select("label_en, label_af, hidden, sort_order")
      .eq("poll_id", data.pollId);
    const all = (options ?? []) as Array<{
      label_en: string;
      label_af: string | null;
      hidden: boolean;
      sort_order: number;
    }>;
    if (all.filter((o) => !o.hidden).length >= 20) throw new Error("Maximum of 20 visible options.");
    if (isDuplicate(data.labelEn, all)) throw new Error("That option is already on this poll.");
    const sort = all.length === 0 ? 10 : Math.max(...all.map((o) => o.sort_order)) + 10;
    const { error } = await sb.from("poll_options").insert({
      poll_id: data.pollId,
      label_en: data.labelEn.trim(),
      label_af: blank(data.labelAf),
      source: "admin",
      hidden: false,
      sort_order: sort,
    });
    if (error) throw new Error(error.message);
    const { data: row } = await sb.from("polls").select(POLL_SELECT).eq("id", data.pollId).single();
    return hydrateAdmin(sb, row as Record<string, unknown>);
  });

export const adminHidePollOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ optionId: z.string().uuid(), hidden: z.boolean() }).parse(i),
  )
  .handler(async ({ context, data }): Promise<AdminPoll> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as unknown as AnyClient, userId);
    const { elevated } = await import("./elevated.server");
    const sb = (await elevated(supabase)) as AnyClient;
    const { data: opt, error: loadErr } = await sb
      .from("poll_options")
      .select("poll_id")
      .eq("id", data.optionId)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!opt) throw new Error("Option not found");
    const { error } = await sb
      .from("poll_options")
      .update({ hidden: data.hidden })
      .eq("id", data.optionId);
    if (error) throw new Error(error.message);
    const { data: row } = await sb.from("polls").select(POLL_SELECT).eq("id", opt.poll_id).single();
    return hydrateAdmin(sb, row as Record<string, unknown>);
  });

export const adminDeletePollOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ optionId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<AdminPoll> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as unknown as AnyClient, userId);
    const { elevated } = await import("./elevated.server");
    const sb = (await elevated(supabase)) as AnyClient;
    const { data: opt, error: loadErr } = await sb
      .from("poll_options")
      .select("poll_id")
      .eq("id", data.optionId)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!opt) throw new Error("Option not found");
    const { error } = await sb.from("poll_options").delete().eq("id", data.optionId);
    if (error) throw new Error(error.message);
    const { data: row } = await sb.from("polls").select(POLL_SELECT).eq("id", opt.poll_id).single();
    return hydrateAdmin(sb, row as Record<string, unknown>);
  });

export type PollInsight = {
  pollId: string;
  question_en: string;
  total_votes: number;
  leader: { id: string; label_en: string; vote_count: number; pct: number } | null;
  overall: Array<{ id: string; label_en: string; vote_count: number; pct: number }>;
  recent: Array<{ label_en: string; at: string }>;
  recent_leader: { label_en: string; count: number } | null;
  suggestion_en: string | null;
  suggestion_af: string | null;
  ai_note: string | null;
};

export type OutingRoute = {
  title_en: string;
  title_af: string;
  start: string;
  destination: string;
  stops: string[];
  distance_en: string;
  distance_af: string;
  why_en: string;
  why_af: string;
};

export type CombinedPollInsight = {
  total_votes: number;
  open_polls: number;
  polls: Array<{
    id: string;
    question_en: string;
    total_votes: number;
    leader: string | null;
    recent_leader: string | null;
  }>;
  suggestion_en: string | null;
  suggestion_af: string | null;
  route: OutingRoute | null;
  ai_note: string | null;
};

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean).slice(0, 8);
}

function parseSuggestion(raw: string): {
  en: string;
  af: string;
  route: OutingRoute | null;
} {
  const t = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const j = JSON.parse(t) as Record<string, unknown>;
    const en = typeof j.en === "string" ? j.en.trim() : "";
    const af = typeof j.af === "string" ? j.af.trim() : en;
    let route: OutingRoute | null = null;
    if (j.route && typeof j.route === "object") {
      const r = j.route as Record<string, unknown>;
      const start = typeof r.start === "string" ? r.start.trim() : "";
      const destination = typeof r.destination === "string" ? r.destination.trim() : "";
      if (start && destination) {
        route = {
          title_en: typeof r.title_en === "string" ? r.title_en.trim() : `${start} to ${destination}`,
          title_af: typeof r.title_af === "string" ? r.title_af.trim() : `${start} na ${destination}`,
          start,
          destination,
          stops: asStringArray(r.stops),
          distance_en: typeof r.distance_en === "string" ? r.distance_en.trim() : "",
          distance_af: typeof r.distance_af === "string" ? r.distance_af.trim() : "",
          why_en: typeof r.why_en === "string" ? r.why_en.trim() : "",
          why_af: typeof r.why_af === "string" ? r.why_af.trim() : "",
        };
      }
    }
    if (en) return { en, af: af || en, route };
  } catch {
    /* not json */
  }
  return { en: t.slice(0, 1200), af: t.slice(0, 1200), route: null };
}

const OUTING_SYSTEM =
  "You advise the Just Wheels Hessequa car club committee (Southern Cape: Stilbaai, Riversdale, Heidelberg, Albertinia). " +
  "Combine ALL poll results (destination AND how far members will drive, plus any other polls). " +
  "If a single winning destination is too far for the distance votes, or if several nearby places scored well, build a better day-run: start, coffee/photo stops, destination. " +
  "Keep it realistic for classics and mixed convoy (tar preferred, fuel, toilets). " +
  "Return JSON only, no markdown: " +
  '{"en":"2-4 sentences","af":"2-4 sinne","route":{"title_en":"","title_af":"","start":"Stilbaai","destination":"","stops":["..."],"distance_en":"","distance_af":"","why_en":"why this beats a single winner","why_af":""}} ' +
  "Set route to null only if a simple one-place outing is clearly best.";

async function grokSuggest(prompt: string): Promise<string> {
  const xai = process.env.XAI_API_KEY;
  if (xai) {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${xai}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4.6",
        temperature: 0.4,
        messages: [
          { role: "system", content: OUTING_SYSTEM },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`xAI ${res.status}${body ? `: ${body.slice(0, 180)}` : ""}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const out = json.choices?.[0]?.message?.content?.trim();
    if (out) return out;
    throw new Error("xAI returned no text");
  }

  const lovableKey = process.env.LOVABLE_API_KEY;
  if (lovableKey) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.4,
        messages: [
          { role: "system", content: OUTING_SYSTEM },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI gateway ${res.status}`);
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const out = json.choices?.[0]?.message?.content?.trim();
    if (out) return out;
  }

  throw new Error("No AI key configured (set XAI_API_KEY on the server).");
}

export const adminPollInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ pollId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<PollInsight> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as unknown as AnyClient, userId);
    const { elevated } = await import("./elevated.server");
    const sb = (await elevated(supabase)) as AnyClient;

    const { data: pollRow, error: pollErr } = await sb
      .from("polls")
      .select(POLL_SELECT)
      .eq("id", data.pollId)
      .maybeSingle();
    if (pollErr) throw new Error(pollErr.message);
    if (!pollRow) throw new Error("Poll not found");
    const poll = await hydrateAdmin(sb, pollRow as Record<string, unknown>);

    const visible = poll.options.filter((o) => !o.hidden);
    const total = visible.reduce((s, o) => s + o.vote_count, 0);
    const overall = visible
      .map((o) => ({
        id: o.id,
        label_en: o.label_en,
        vote_count: o.vote_count,
        pct: total === 0 ? 0 : Math.round((o.vote_count / total) * 100),
      }))
      .sort((a, b) => b.vote_count - a.vote_count);
    const leader = overall[0] && overall[0].vote_count > 0 ? overall[0] : null;

    const { data: recentRows, error: recErr } = await sb
      .from("poll_votes")
      .select("option_id, created_at")
      .eq("poll_id", data.pollId)
      .order("created_at", { ascending: false })
      .limit(12);
    if (recErr) throw new Error(recErr.message);

    const labelById = new Map(poll.options.map((o) => [o.id, o.label_en]));
    const recent: Array<{ label_en: string; at: string }> = (recentRows ?? []).map(
      (row: { option_id: string; created_at: string }) => ({
        label_en: labelById.get(String(row.option_id)) ?? "—",
        at: String(row.created_at),
      }),
    );
    const recentCounts = new Map<string, number>();
    for (const vote of recent) recentCounts.set(vote.label_en, (recentCounts.get(vote.label_en) ?? 0) + 1);
    let recent_leader: { label_en: string; count: number } | null = null;
    for (const [label_en, count] of recentCounts) {
      if (!recent_leader || count > recent_leader.count) recent_leader = { label_en, count };
    }

    let suggestion_en: string | null = null;
    let suggestion_af: string | null = null;
    let ai_note: string | null = null;

    if (total === 0) {
      ai_note = "No votes yet.";
    } else {
      const overallLine = overall
        .map((o) => `${o.label_en}: ${o.vote_count} (${o.pct}%)`)
        .join("; ");
      const recentLine = recent.map((vote) => vote.label_en).join(" → ");
      const prompt = [
        `Poll: ${poll.question_en}`,
        `Overall (${total} votes): ${overallLine}`,
        `Most recent ${recent.length} votes (newest first): ${recentLine || "none"}`,
        recent_leader
          ? `Among those recent votes, "${recent_leader.label_en}" appears ${recent_leader.count} times.`
          : "",
        "Suggest what the club should plan next (outing, venue, distance). Say whether recent votes agree with or pull away from the overall leader.",
      ]
        .filter(Boolean)
        .join("\n");
      try {
        const raw = await grokSuggest(prompt);
        const parsed = parseSuggestion(raw);
        suggestion_en = parsed.en;
        suggestion_af = parsed.af;
      } catch (e) {
        ai_note = e instanceof Error ? e.message : "AI suggestion unavailable";
      }
    }

    return {
      pollId: poll.id,
      question_en: poll.question_en,
      total_votes: total,
      leader,
      overall,
      recent,
      recent_leader,
      suggestion_en,
      suggestion_af,
      ai_note,
    };
  });

export const adminCombinedPollInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CombinedPollInsight> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as unknown as AnyClient, userId);
    const { elevated } = await import("./elevated.server");
    const sb = (await elevated(supabase)) as AnyClient;

    const { data: pollRows, error } = await sb
      .from("polls")
      .select(POLL_SELECT)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    const polls: AdminPoll[] = [];
    for (const row of pollRows ?? []) polls.push(await hydrateAdmin(sb, row as Record<string, unknown>));

    const summaries: CombinedPollInsight["polls"] = [];
    const promptParts: string[] = [];
    let total_votes = 0;

    for (const poll of polls) {
      const visible = poll.options.filter((o) => !o.hidden);
      const total = visible.reduce((s, o) => s + o.vote_count, 0);
      total_votes += total;
      const ranked = [...visible].sort((a, b) => b.vote_count - a.vote_count);
      const leader = ranked[0] && ranked[0].vote_count > 0 ? ranked[0].label_en : null;

      const { data: recentRows } = await sb
        .from("poll_votes")
        .select("option_id, created_at")
        .eq("poll_id", poll.id)
        .order("created_at", { ascending: false })
        .limit(12);
      const labelById = new Map(poll.options.map((o) => [o.id, o.label_en]));
      const recentLabels = (recentRows ?? []).map(
        (row: { option_id: string }) => labelById.get(String(row.option_id)) ?? "—",
      );
      const recentCounts = new Map<string, number>();
      for (const label of recentLabels) recentCounts.set(label, (recentCounts.get(label) ?? 0) + 1);
      let recent_leader: string | null = null;
      let recentBest = 0;
      for (const [label, count] of recentCounts) {
        if (count > recentBest) {
          recentBest = count;
          recent_leader = label;
        }
      }

      summaries.push({
        id: poll.id,
        question_en: poll.question_en,
        total_votes: total,
        leader,
        recent_leader,
      });

      const overallLine = ranked
        .map((o) => {
          const pct = total === 0 ? 0 : Math.round((o.vote_count / total) * 100);
          return `${o.label_en}: ${o.vote_count} (${pct}%)`;
        })
        .join("; ");
      promptParts.push(
        [
          `POLL: ${poll.title_en || poll.question_en}`,
          `Question: ${poll.question_en}`,
          `Status: ${poll.status}`,
          `Overall (${total} votes): ${overallLine || "no votes"}`,
          `Most recent votes (newest first): ${recentLabels.join(" → ") || "none"}`,
        ].join("\n"),
      );
    }

    let suggestion_en: string | null = null;
    let suggestion_af: string | null = null;
    let route: OutingRoute | null = null;
    let ai_note: string | null = null;

    if (total_votes === 0) {
      ai_note = "No votes yet across polls.";
    } else {
      const prompt = [
        "Club base: Hessequa (Stilbaai / Riversdale), Western Cape.",
        "Use EVERY poll below together — destination, driving distance, and any others.",
        "Prefer a route that more members can join over a single far-away winner.",
        "",
        promptParts.join("\n\n"),
      ].join("\n");
      try {
        const raw = await grokSuggest(prompt);
        const parsed = parseSuggestion(raw);
        suggestion_en = parsed.en;
        suggestion_af = parsed.af;
        route = parsed.route;
      } catch (e) {
        ai_note = e instanceof Error ? e.message : "AI suggestion unavailable";
      }
    }

    return {
      total_votes,
      open_polls: polls.filter((p) => p.status === "open").length,
      polls: summaries,
      suggestion_en,
      suggestion_af,
      route,
      ai_note,
    };
  });
