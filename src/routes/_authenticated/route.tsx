import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Client-only auth gate. We use getSession() (reads local storage) rather than
// getUser() so the members area — including the digital card — still opens
// when the device is offline.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
    return { userId: data.session.user.id };
  },
  component: () => <Outlet />,
});
