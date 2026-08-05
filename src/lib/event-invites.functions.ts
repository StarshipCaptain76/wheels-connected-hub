import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type InviteStatus = {
  eligible: number;
  invited: number;
  newSinceLast: number;
  lastSentAt: string | null;
  lastSentCount: number;
};

export const getEventInviteStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ eventId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<InviteStatus> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { collectRecipients } = await import("./event-invites.server");
    const recipients = await collectRecipients(supabase);

    const { elevated } = await import("./elevated.server");
    const supabaseAdmin = await elevated(supabase);
    const { data: invites } = await supabaseAdmin
      .from("event_invites")
      .select("user_id")
      .eq("event_id", data.eventId);
    const invitedIds = new Set((invites ?? []).map((r) => r.user_id));

    const { data: ev } = await supabaseAdmin
      .from("events")
      .select("invites_sent_at, invites_sent_count")
      .eq("id", data.eventId)
      .maybeSingle();

    return {
      eligible: recipients.length,
      invited: invitedIds.size,
      newSinceLast: recipients.filter((r) => !invitedIds.has(r.userId)).length,
      lastSentAt: (ev?.invites_sent_at as string | null) ?? null,
      lastSentCount: Number(ev?.invites_sent_count ?? 0),
    };
  });

export const sendEventInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ eventId: z.string().uuid(), onlyNew: z.boolean().default(false) }).parse(i),
  )
  .handler(async ({ context, data }): Promise<{ sent: number; skipped: number; failed: number }> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { runEventInvites } = await import("./event-invites.server");
    return runEventInvites(data.eventId, data.onlyNew, supabase);
  });
