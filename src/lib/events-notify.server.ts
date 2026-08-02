/** Server-only: notify members that a new event was published. Never throws. */
export async function notifyNewEvent(id: string, title: string, titleAf: string | null) {
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
    });
  } catch (e) {
    console.error("[events] notification failed", e);
  }
}
