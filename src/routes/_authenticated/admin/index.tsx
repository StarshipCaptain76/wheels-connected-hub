import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllMembers } from "@/lib/admin-members.functions";
import { listPendingListings } from "@/lib/listings.functions";
import { listAllEvents } from "@/lib/events.functions";
import { listAllGalleryItems } from "@/lib/gallery.functions";
import { listSubscribers } from "@/lib/newsletter.functions";
import { getCurrentFeaturedMember } from "@/lib/featured-member.functions";
import {
  Tag,
  Calendar,
  Image as ImageIcon,
  Users,
  Mail,
  Star,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [{ title: "Admin Overview — Just Wheels" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminOverview,
});

function AdminOverview() {
  const pending = useServerFn(listPendingListings);
  const events = useServerFn(listAllEvents);
  const gallery = useServerFn(listAllGalleryItems);
  const members = useServerFn(listAllMembers);
  const subs = useServerFn(listSubscribers);
  const featured = useServerFn(getCurrentFeaturedMember);

  const pendingQ = useQuery({ queryKey: ["listings", "moderation"], queryFn: () => pending() });
  const eventsQ = useQuery({ queryKey: ["events", "admin"], queryFn: () => events() });
  const galleryQ = useQuery({ queryKey: ["gallery", "admin"], queryFn: () => gallery() });
  const membersQ = useQuery({ queryKey: ["admin", "members"], queryFn: () => members() });
  const subsQ = useQuery({ queryKey: ["newsletter", "subscribers"], queryFn: () => subs() });
  const featuredQ = useQuery({ queryKey: ["featured-member"], queryFn: () => featured() });

  const now = Date.now();
  const upcoming = (eventsQ.data ?? []).filter((e) => new Date(e.starts_at).getTime() > now).length;
  const unpublishedGallery = (galleryQ.data ?? []).filter((g) => !g.is_published).length;
  const activeSubs = (subsQ.data ?? []).filter((s) => !s.unsubscribed_at).length;
  const pendingMembers = (membersQ.data ?? []).filter((m) => m.membership_status === "pending").length;

  const cards = [
    { to: "/admin/classifieds", label: "Pending listings", value: pendingQ.data?.length ?? "—", icon: Tag },
    { to: "/admin/events", label: "Upcoming events", value: upcoming, icon: Calendar },
    { to: "/admin/gallery", label: "Unpublished photos", value: unpublishedGallery, icon: ImageIcon },
    { to: "/admin/members", label: `Members (${pendingMembers} pending)`, value: membersQ.data?.length ?? "—", icon: Users },
    { to: "/admin/newsletter", label: "Active subscribers", value: activeSubs, icon: Mail },
    {
      to: "/admin/featured",
      label: featuredQ.data ? `Featured: ${featuredQ.data.display_name ?? "—"}` : "No featured member",
      value: featuredQ.data ? "★" : "—",
      icon: Star,
    },
  ] as const;

  return (
    <div>
      <h1 className="font-display text-4xl tracking-wide text-ink">Overview</h1>
      <p className="mt-1 text-sm text-ink/60">Quick pulse on the club. Pick a section on the left.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.to}
              to={c.to}
              className="group rounded-2xl border-2 border-ink bg-paper p-5 shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
            >
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 text-primary" />
                <ArrowRight className="h-4 w-4 text-ink/40 group-hover:text-primary" />
              </div>
              <div className="mt-3 font-display text-3xl text-ink">{c.value}</div>
              <div className="mt-1 text-xs font-bold uppercase tracking-wider text-ink/60">{c.label}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
