import { initials, type MemberCardProfile } from "@/components/MemberCard";
import { LOGO_URL } from "./brand";
const PRINT_W = 1013;
const PRINT_H = 638;
const INK = "#000000";
const PAPER = "#ffffff";

export async function createMemberCardImage(
  profile: MemberCardProfile,
  carPhoto: string | null,
  facePhoto: string | null,
  af: boolean,
) {
  const canvas = document.createElement("canvas");
  canvas.width = PRINT_W;
  canvas.height = PRINT_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");

  const year = new Date(profile.joined_at).getFullYear();
  const name = profile.display_name ?? "—";
  const ride = profile.favourite_ride || (af ? "Geen ry gelys nie" : "No ride listed");
  const faceInitials = initials(profile.display_name);
  const slug =
    (profile.display_name || "member")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "member";

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, PRINT_W, PRINT_H);

  if (carPhoto) {
    try {
      const img = await loadImage(carPhoto);
      const scale = Math.max(PRINT_W / img.width, PRINT_H / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (PRINT_W - w) / 2, (PRINT_H - h) / 2, w, h);
    } catch {
      /* solid white bg */
    }
  }

  const grad = ctx.createLinearGradient(0, 0, PRINT_W * 0.85, 0);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.92)");
  grad.addColorStop(1, "rgba(255,255,255,0.7)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, PRINT_W, PRINT_H);

  const bot = ctx.createLinearGradient(0, PRINT_H * 0.45, 0, PRINT_H);
  bot.addColorStop(0, "rgba(255,255,255,0)");
  bot.addColorStop(1, "rgba(255,255,255,1)");
  ctx.fillStyle = bot;
  ctx.fillRect(0, 0, PRINT_W, PRINT_H);

  try {
    const logo = await loadImage(LOGO_URL);
    drawCircleImage(ctx, logo, 48, 48, 36);
  } catch {
    /* skip */
  }

  ctx.fillStyle = INK;
  ctx.font = "700 28px Bebas Neue, Barlow, sans-serif";
  ctx.fillText("JUST WHEELS", 100, 52);
  ctx.font = "600 14px Barlow, sans-serif";
  ctx.fillText("HESSEQUA", 100, 74);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  roundRect(ctx, PRINT_W - 140, 28, 110, 28, 14);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = "700 12px Barlow, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(af ? "LIDKAART" : "MEMBER", PRINT_W - 85, 47);
  ctx.textAlign = "left";

  const nameParts = name.trim().split(/\s+/).filter(Boolean);
  const nameLine1 = (nameParts[0] ?? "—").toUpperCase();
  const nameLine2 = nameParts.length > 1 ? nameParts.slice(1).join(" ").toUpperCase() : null;
  const longest = nameLine2 && nameLine2.length > nameLine1.length ? nameLine2 : nameLine1;
  const maxNameW = PRINT_W - 120;
  let nameSize = 168;
  ctx.font = `700 ${nameSize}px Bebas Neue, Barlow, sans-serif`;
  while (ctx.measureText(longest).width > maxNameW && nameSize > 64) {
    nameSize -= 2;
    ctx.font = `700 ${nameSize}px Bebas Neue, Barlow, sans-serif`;
  }
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (nameLine2) {
    const gap = nameSize * 0.92;
    ctx.fillText(nameLine1, PRINT_W / 2, PRINT_H / 2 - gap / 2);
    ctx.fillText(nameLine2, PRINT_W / 2, PRINT_H / 2 + gap / 2);
  } else {
    ctx.fillText(nameLine1, PRINT_W / 2, PRINT_H / 2);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const metaLeft = 48;
  const metaBottom = PRINT_H - 32;
  const rideSize = 44;
  const townSize = 42;
  const sinceSize = 24;
  const sinceLabel = `${(af ? "Sedert" : "Since").toUpperCase()} ${year}`;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = `600 ${sinceSize}px Barlow, sans-serif`;
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0.1em";
  ctx.fillText(sinceLabel, metaLeft, metaBottom);
  const sinceW = ctx.measureText(sinceLabel).width;
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";

  if (profile.town) {
    ctx.font = `600 ${townSize}px Barlow, sans-serif`;
    ctx.fillText(profile.town, metaLeft + sinceW + 24, metaBottom);
  }

  ctx.font = `600 ${rideSize}px Barlow, sans-serif`;
  ctx.fillText(ride.slice(0, 42), metaLeft, metaBottom - townSize - 10);

  const cx = PRINT_W - 90;
  const cy = PRINT_H - 90;
  const r = 62;
  try {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.stroke();

    if (facePhoto) {
      try {
        const face = await loadImage(facePhoto);
        drawCircleImage(ctx, face, cx, cy, r);
      } catch {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = PAPER;
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.font = "700 36px Bebas Neue, Barlow, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(faceInitials, cx, cy);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = PAPER;
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.font = "700 36px Bebas Neue, Barlow, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(faceInitials, cx, cy);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
    ctx.restore();

    const logo = await loadImage(LOGO_URL);
    const br = 22;
    const bx = cx + r * 0.65;
    const by = cy + r * 0.65;
    ctx.beginPath();
    ctx.arc(bx, by, br + 2, 0, Math.PI * 2);
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    drawCircleImage(ctx, logo, bx, by, br);
  } catch {
    /* skip */
  }

  ctx.strokeStyle = INK;
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, PRINT_W - 10, PRINT_H - 10);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Could not create card image")), "image/png");
  });
  return new File([blob], `just-wheels-member-${slug}.png`, { type: "image/png" });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:\/\//i.test(src) && !src.includes(window.location.host)) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function drawCircleImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
