import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listAllMembers } from "@/lib/admin-members.functions";
import { listPendingListings } from "@/lib/listings.functions";
import { listAllEvents } from "@/lib/events.functions";
import { listAllGalleryItems } from "@/lib/gallery.functions";
import { listSubscribers } from "@/lib/newsletter.functions";
import { listAllSponsors } from "@/lib/sponsors.functions";
import { sendTestNotification } from "@/lib/notify-test.functions";
import {
  Tag,
  Calendar,
  Image as ImageIcon,
  Users,
  Mail,
  Handshake,
  ArrowRight,
  Bell,
} from "lucide-react";


export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [{ title: "Admin Overview — Just Wheels" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminOverview,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthBounds() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based
  const start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  return { start, end };
}

function isSponsorPubliclyActive(s: {
  is_active: boolean;
  billing_starts_at: string | null;
  billing_ends_at: string | null;
}): boolean {
  if (!s.is_active) return false;
  const today = todayISO();
  const start = s.billing_starts_at ? String(s.billing_starts_at).slice(0, 10) : null;
  const end = s.billing_ends_at ? String(s.billing_ends_at).slice(0, 10) : null;
  if (start && start > today) return false;
  if (end && end < today) return false;
  return true;
}

function AdminOverview() {
  const pending = useServerFn(listPendingListings);
  const events = useServerFn(listAllEvents);
  const gallery = useServerFn(listAllGalleryItems);
  const members = useServerFn(listAllMembers);
  const subs = useServerFn(listSubscribers);
  const sponsors = useServerFn(listAllSponsors);

  const pendingQ = useQuery({ queryKey: ["listings", "moderation"], queryFn: () => pending() });
  const eventsQ = useQuery({ queryKey: ["events", "admin"], queryFn: () => events() });
  const galleryQ = useQuery({ queryKey: ["gallery", "admin"], queryFn: () => gallery() });
  const membersQ = useQuery({ queryKey: ["admin", "members"], queryFn: () => members() });
  const subsQ = useQuery({ queryKey: ["newsletter", "subscribers"], queryFn: () => subs() });
  const sponsorsQ = useQuery({ queryKey: ["sponsors", "admin"], queryFn: () => sponsors() });

  const now = Date.now();
  const upcoming = (eventsQ.data ?? []).filter((e) => new Date(e.starts_at).getTime() > now).length;
  const unpublishedGallery = (galleryQ.data ?? []).filter((g) => !g.is_published).length;
  const activeSubs = (subsQ.data ?? []).filter((s) => !s.unsubscribed_at).length;
  const pendingMembers = (membersQ.data ?? []).filter((m) => m.membership_status === "pending").length;
  const pendingListings = (pendingQ.data ?? []).filter((l) => l.status === "pending").length;
  const totalMembers = membersQ.data?.length ?? 0;

  const { start: monthStart, end: monthEnd } = monthBounds();
  const sponsorList = sponsorsQ.data ?? [];
  const activeSponsors = sponsorList.filter(isSponsorPubliclyActive).length;
  const expireThisMonth = sponsorList.filter((s) => {
    if (!s.billing_ends_at) return false;
    const end = String(s.billing_ends_at).slice(0, 10);
    // Still active (or would be) and end falls in current calendar month
    return end >= monthStart && end <= monthEnd && (s.is_active || end >= todayISO());
  }).length;

  const cards = [
    {
      to: "/admin/classifieds",
      label: "Pending listings",
      value: pendingQ.isLoading ? "…" : pendingListings,
      icon: Tag,
      highlight: pendingListings > 0,
    },
    {
      to: "/admin/events",
      label: "Upcoming events",
      value: eventsQ.isLoading ? "…" : upcoming,
      icon: Calendar,
    },
    {
      to: "/admin/gallery",
      label: "Unpublished photos",
      value: galleryQ.isLoading ? "…" : unpublishedGallery,
      icon: ImageIcon,
    },
    {
      to: "/admin/members",
      label:
        pendingMembers > 0
          ? `${pendingMembers} pending · ${totalMembers} total`
          : `Members · ${totalMembers} total`,
      value: membersQ.isLoading ? "…" : pendingMembers > 0 ? pendingMembers : totalMembers,
      icon: Users,
      highlight: pendingMembers > 0,
    },
    {
      to: "/admin/sponsors",
      label:
        expireThisMonth > 0
          ? `${activeSponsors} active · ${expireThisMonth} due this month`
          : `${activeSponsors} active sponsors`,
      value: sponsorsQ.isLoading ? "…" : activeSponsors,
      sub:
        !sponsorsQ.isLoading && expireThisMonth > 0
          ? `${expireThisMonth} expire this month`
          : undefined,
      icon: Handshake,
      highlight: expireThisMonth > 0,
    },
    {
      to: "/admin/newsletter",
      label: "Active subscribers",
      value: subsQ.isLoading ? "…" : activeSubs,
      icon: Mail,
    },
  ] as const;

  return (
    <div>
      <h1 className="font-display text-4xl tracking-wide text-ink">Overview</h1>
      <p className="mt-1 text-sm text-ink/60">Quick pulse on the club. Pick a section on the left.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          const highlight = "highlight" in c && c.highlight;
          const sub = "sub" in c ? c.sub : undefined;
          return (
            <Link
              key={c.to}
              to={c.to}
              className={`group rounded-2xl border-2 border-ink bg-paper p-5 shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none ${
                highlight ? "ring-2 ring-primary ring-offset-2" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 text-primary" />
                <ArrowRight className="h-4 w-4 text-ink/40 group-hover:text-primary" />
              </div>
              <div className="mt-3 font-display text-3xl text-ink">{c.value}</div>
              <div className="mt-1 text-xs font-bold uppercase tracking-wider text-ink/60">{c.label}</div>
              {sub ? (
                <div className="mt-1 text-xs font-semibold text-primary">{sub}</div>
              ) : null}
            </Link>
          );
        })}
      </div>

      <TestNotificationButton />
    </div>
  );
}

function TestNotificationButton() {
  const send = useServerFn(sendTestNotification);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-8 rounded-2xl border-2 border-ink bg-paper p-5 shadow-[4px_4px_0_0_var(--color-ink)]">
      <p className="font-display text-sm tracking-wide text-ink">Notification check</p>
      <p className="mt-1 text-xs text-ink/60">
        Sends a test notification to your own bell so you can confirm delivery works.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await send();
            if (res.ok) toast.success(res.message);
            else toast.error(res.message);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed");
          } finally {
            setBusy(false);
          }
        }}
        className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm font-bold uppercase tracking-wide text-ink hover:bg-ink/5 disabled:opacity-50"
      >
        <Bell className="h-4 w-4" />
        {busy ? "Sending…" : "Send me a test notification"}
      </button>
    </div>
  );
}

