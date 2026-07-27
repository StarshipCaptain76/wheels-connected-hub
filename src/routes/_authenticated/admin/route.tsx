import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { getMyRoles } from "@/lib/roles.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Portal — Just Wheels" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    try {
      const roles = await getMyRoles();
      if (!roles.isAdmin) throw redirect({ to: "/members" });
    } catch (err) {
      // Rethrow router redirects; otherwise bounce non-admins home.
      if (err && typeof err === "object" && "to" in err) throw err;
      throw redirect({ to: "/members" });
    }
  },
  component: () => (
    <AdminShell>
      <Outlet />
    </AdminShell>
  ),
});
