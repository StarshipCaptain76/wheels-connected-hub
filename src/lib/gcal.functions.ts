import { createServerFn } from "@tanstack/react-start";
import type { PublicEvent } from "./events.functions";

const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

type GCalEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string };
  htmlLink?: string;
  status?: string;
};

function toIso(v?: { dateTime?: string; date?: string }): string | null {
  if (!v) return null;
  if (v.dateTime) return new Date(v.dateTime).toISOString();
  if (v.date) return new Date(v.date + "T00:00:00").toISOString();
  return null;
}

export const listGoogleCalendarEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicEvent[]> => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_CALENDAR_API_KEY;
    if (!lovableKey || !connKey) return [];

    const calendarId = process.env.CLUB_GOOGLE_CALENDAR_ID || "primary";
    const params = new URLSearchParams({
      timeMin: new Date().toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "25",
    });
    const url = `${GATEWAY}/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": connKey,
        },
      });
      if (!res.ok) {
        console.error(`[gcal] ${res.status} ${await res.text()}`);
        return [];
      }
      const body = (await res.json()) as { items?: GCalEvent[] };
      return (body.items ?? [])
        .filter((e) => e.status !== "cancelled")
        .map((e): PublicEvent | null => {
          const starts = toIso(e.start);
          if (!starts) return null;
          return {
            id: `gcal:${e.id}`,
            title: e.summary ?? "Untitled",
            title_af: null,
            description: e.description ?? null,
            description_af: null,
            location: e.location ?? null,
            starts_at: starts,
            ends_at: toIso(e.end),
            cover_url: null,
          };
        })
        .filter((e): e is PublicEvent => e !== null);
    } catch (err) {
      console.error("[gcal] fetch failed", err);
      return [];
    }
  },
);
