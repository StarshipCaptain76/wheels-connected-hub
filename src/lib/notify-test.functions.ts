import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only: send a test in-app notification to yourself to verify delivery. */
export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; message: string }> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) return { ok: false, message: "Admins only" };

    try {
      const { error } = await supabase.rpc("notify_user", {
        _user_id: userId,
        _type: "admin_new_member",
        _title_en: "Test notification",
        _title_af: "Toetskennisgewing",
        _body_en: "If you can see this, in-app notifications are working.",
        _body_af: "As jy dit sien, werk kennisgewings in die app.",
        _link: "/admin",
      });
      if (error) throw error;
      return { ok: true, message: "Test notification sent — check the bell." };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[notify] test failed", message);
      return { ok: false, message };
    }
  });
