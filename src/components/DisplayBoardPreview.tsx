import { LOGO_URL } from "@/lib/brand";
import type { GarageVehicle } from "@/lib/garage.functions";
import { specRows, type BoardOwner, type BoardContent } from "@/lib/display-board";

const INK = "#140e0c";
const RED = "#cc2222";
const MUTED = "#8a8078";

export function DisplayBoardPreview({
  vehicle,
  owner,
  lang,
  content,
}: {
  vehicle: GarageVehicle;
  owner: BoardOwner;
  lang: "en" | "af";
  content: BoardContent;
}) {
  const af = lang === "af";
  const hero = vehicle.photos.find((p) => p.url)?.url ?? null;
  const title = [vehicle.make, vehicle.model].filter(Boolean).join(" ").toUpperCase() || "MY RIDE";
  const yearTxt = vehicle.year ? String(vehicle.year) : "";
  const sub = [vehicle.nickname ? `"${vehicle.nickname}"` : null, owner.display_name, owner.town]
    .filter(Boolean)
    .join("   ·   ");
  const rows = content === "story" ? [] : specRows(vehicle, af);
  const story =
    (af ? vehicle.story_af || vehicle.story : vehicle.story) ||
    (af
      ? "Voeg spesifikasies by in My Garage > Wysig voertuig > Spesifikasieblad."
      : "Add specs in My Garage > Edit vehicle > Spec sheet.");
  const numTxt = owner.member_number
    ? `${af ? "LIDNOMMER" : "MEMBER NO."}  #${String(owner.member_number).padStart(4, "0")}`
    : "";
  const twoCol = rows.length > 8;

  return (
    <article
      aria-label={af ? "Vertoonbord voorskou" : "Display board preview"}
      className="overflow-hidden rounded-xl border-4 border-black bg-white text-black shadow-[8px_8px_0_0_var(--color-primary)]"
      style={{ color: INK }}
    >
      <div className="aspect-[3/2] w-full p-[4.3%] font-sans">
        <header className="flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[clamp(1.1rem,3.2vw,1.9rem)] leading-none tracking-wide">
              JUST WHEELS
            </span>
            <span
              className="font-display text-[clamp(0.7rem,2vw,1.15rem)] leading-none tracking-wide"
              style={{ color: RED }}
            >
              HESSEQUA
            </span>
          </div>
          {numTxt ? (
            <span className="shrink-0 text-[clamp(0.55rem,1.3vw,0.8rem)] font-bold uppercase tracking-wider">
              {numTxt}
            </span>
          ) : null}
        </header>
        <div className="mt-[1.2%] h-[3px] w-full" style={{ background: RED }} />

        <div className="mt-[2.6%] grid h-[72%] grid-cols-[52%_1fr] gap-[3.4%]">
          <div className="overflow-hidden border-[1.5px] border-black bg-[#eeeae5]">
            {hero ? (
              <img src={hero} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="min-w-0 font-display text-[clamp(1rem,3.1vw,2.1rem)] leading-[0.9] tracking-wide">
                {title}
              </h3>
              {yearTxt ? (
                <span
                  className="shrink-0 font-display text-[clamp(0.85rem,2.2vw,1.5rem)] leading-none"
                  style={{ color: RED }}
                >
                  {yearTxt}
                </span>
              ) : null}
            </div>
            {sub ? (
              <p className="mt-[0.6%] truncate text-[clamp(0.55rem,1.35vw,0.85rem)]">{sub}</p>
            ) : null}
            <div className="mt-[1.2%] h-[2px] w-full" style={{ background: RED }} />

            <div className="mt-[2.4%] min-h-0 flex-1 overflow-y-auto">
              {rows.length === 0 ? (
                <p className="whitespace-pre-wrap text-[clamp(0.6rem,1.5vw,0.95rem)] leading-snug">
                  {story}
                </p>
              ) : (
                <dl
                  className={`grid ${twoCol ? "grid-cols-2 gap-x-3" : "grid-cols-1"} content-start`}
                >
                  {rows.map((r) => (
                    <div
                      key={r.label}
                      className="grid grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] items-start gap-x-2 border-b border-black/10 py-[0.45%]"
                    >
                      <dt
                        className="text-[clamp(0.45rem,1.05vw,0.65rem)] font-bold uppercase leading-snug tracking-wide"
                        style={{ color: RED }}
                      >
                        {r.label}
                      </dt>
                      <dd className="min-w-0 whitespace-normal break-words text-right text-[clamp(0.5rem,1.15vw,0.75rem)] leading-snug">
                        {r.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </div>

        <footer className="mt-[2.2%] flex items-center justify-between border-t border-black/15 pt-[1.8%]">
          <div className="flex items-center gap-2">
            {owner.avatar_url ? (
              <img
                src={owner.avatar_url}
                alt=""
                className="h-[clamp(1.4rem,3.6vw,2.1rem)] w-[clamp(1.4rem,3.6vw,2.1rem)] rounded-full border border-black object-cover"
              />
            ) : null}
            <span className="text-[clamp(0.55rem,1.3vw,0.8rem)]" style={{ color: MUTED }}>
              justwheels.co.za
            </span>
          </div>
          <img
            src={LOGO_URL}
            alt=""
            className="h-[clamp(1.6rem,4vw,2.4rem)] w-[clamp(1.6rem,4vw,2.4rem)] rounded-full border border-black object-cover"
          />
        </footer>
      </div>
    </article>
  );
}
