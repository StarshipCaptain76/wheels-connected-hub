/** Server-only: notify members that a new event was published. Never throws. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyNewEvent(id: string, title: string, titleAf: string | null, client?: any) {
  try {
    const { fanOut } = await import("./notify.server");
    await fanOut({
      type: "new_event",
      title_en: "New event on the calendar",
      title_af: "Nuwe byeenkoms op die kalender",
      body_en: title,
      body_af: titleAf ?? title,
      link: `/events/${id}`,
      related_id: id,
    }, client);
  } catch (e) {
    console.error("[events] notification failed", e);
  }
}

/** Server-only: notify members that photos were added to a past event. Never throws. */
export async function notifyPastEventPhotos(
  eventId: string,
  excludeUserId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: any,
): Promise<void> {
  try {
    if (!client) {
      console.error("[events] photo notification blocked: authenticated client required");
      return;
    }
    const { error } = await client.rpc("notify_event_photos", {
      _event_id: eventId,
      _exclude: excludeUserId ?? null,
    });
    if (error) throw error;
  } catch (e) {
    console.error("[events] photo notification failed", e);
  }
}
