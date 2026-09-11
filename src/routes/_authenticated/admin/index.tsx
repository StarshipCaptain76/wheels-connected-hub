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
import { listAllConcoursQuestionsAdmin } from "@/lib/concours.functions";
import {
  Tag,
  Calendar,
  Image as ImageIcon,
  Users,
  Mail,
  Handshake,
  ArrowRight,
  Bell,
  Trophy,
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
  const questionsFn = useServerFn(listAllConcoursQuestionsAdmin);
  const questionsQ = useQuery({
    queryKey: ["concours-questions-admin"],
    queryFn: () => questionsFn(),
  });
  const activeQuestions = (questionsQ.data ?? []).filter((q) => q.active !== false).length;

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
      to: "/admin/concours",
      label: "Active concours questions",
      value: questionsQ.isLoading ? "…" : activeQuestions,
      icon: Trophy,
    },
    {
      to: "/admin/newsletter",
      label: "Active subscribers",
      value: subsQ.isLoading ? "…" : activeSubs,
      icon: Mail,
    },
  ] as const;

  const attention = cards.filter((c) => "highlight" in c && c.highlight);

  return (
    <div>
      <h1 className="font-display text-2xl tracking-wide text-ink sm:text-3xl">Overview</h1>
      <p className="mt-0.5 text-xs text-ink/55 md:hidden">Menu (☰) jumps to any section.</p>
      <p className="mt-0.5 hidden text-xs text-ink/55 md:block">Pick a section on the left.</p>

      {attention.length > 0 && (
        <div className="mt-3 rounded-lg border-2 border-primary bg-primary/10 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Needs action</p>
          <ul className="mt-1 space-y-1">
            {attention.map((c) => (
              <li key={c.to}>
                <Link to={c.to} className="flex items-center justify-between text-sm font-bold text-ink">
                  <span>{c.label}</span>
                  <span className="font-display text-lg text-primary">{c.value}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 overflow-hidden rounded-xl border-2 border-ink bg-paper">
        {cards.map((c, i) => {
          const Icon = c.icon;
          const highlight = "highlight" in c && c.highlight;
          const sub = "sub" in c ? c.sub : undefined;
          return (
            <Link
              key={c.to}
              to={c.to}
              className={`flex items-center gap-3 px-3 py-2.5 ${
                i > 0 ? "border-t border-ink/10" : ""
              } ${highlight ? "bg-primary/5" : "hover:bg-ink/5"}`}
            >
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold leading-tight text-ink">{c.label}</div>
                {sub ? <div className="text-[11px] font-semibold text-primary">{sub}</div> : null}
              </div>
              <div className="font-display text-xl leading-none text-ink">{c.value}</div>
              <ArrowRight className="h-4 w-4 shrink-0 text-ink/30" />
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
      className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink/50 hover:text-ink disabled:opacity-50"
    >
      <Bell className="h-3.5 w-3.5" />
      {busy ? "Sending…" : "Send me a test notification"}
    </button>
  );
}

