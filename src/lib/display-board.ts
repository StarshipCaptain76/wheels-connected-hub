/**
 * Exhibition display board — 600 x 900 mm portrait PDF.
 * Printed and propped next to the car at shows.
 * Client-side only (uses canvas + jsPDF).
 */
import { jsPDF } from "jspdf";
import type { GarageVehicle } from "@/lib/garage.functions";
import { LOGO_URL } from "@/lib/brand";

const W = 600;
const H = 900;
const M = 34; // margin

const INK = "#140e0c";
const PAPER = "#f5f0e8";
const RED = "#cc2222";

export type BoardOwner = {
  display_name: string | null;
  member_number: number | null;
  town: string | null;
  avatar_url: string | null;
};

type SpecRow = { label: string; value: string };

function specRows(v: GarageVehicle, af: boolean): SpecRow[] {
  const L = (en: string, a: string) => (af ? a : en);
  const raw: Array<[string, string | null]> = [
    [L("Built by", "Gebou deur"), v.built_by],
    [L("Engine", "Enjin"), v.engine],
    [L("Power", "Krag"), v.power],
    [L("Torque", "Wringkrag"), v.torque],
    [L("0 - 100 km/h", "0 - 100 km/h"), v.acceleration],
    [L("Quarter mile", "Kwartmyl"), v.quarter_mile],
    [L("Top speed", "Topspoed"), v.top_speed],
    [L("Fuel economy", "Brandstofverbruik"), v.fuel_economy],
    [L("Transmission", "Transmissie"), v.transmission],
    [L("Diff ratio", "Ewenaarverhouding"), v.diff_ratio],
    [L("Suspension front", "Vering voor"), v.suspension_front],
    [L("Suspension rear", "Vering agter"), v.suspension_rear],
    [L("Brakes front", "Remme voor"), v.brakes_front],
    [L("Brakes rear", "Remme agter"), v.brakes_rear],
    [L("Wheels & tyres", "Wiele & bande"), v.wheels_tyres],
    [L("Size (L x W)", "Grootte (L x B)"), v.car_size],
    [L("Weight", "Gewig"), v.car_weight],
  ];
  return raw
    .filter(([, val]) => Boolean(val && val.trim()))
    .map(([label, val]) => ({ label, value: (val as string).trim() }));
}

export function boardHasSpecs(v: GarageVehicle): boolean {
  return specRows(v, false).length > 0;
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

/** Cover-crop an image to a target aspect ratio and return a JPEG data URL. */
async function coverJpeg(src: string, ratio: number, maxW = 2400): Promise<string> {
  const img = await loadImage(src);
  const targetW = Math.min(maxW, Math.max(img.width, 1200));
  const targetH = Math.round(targetW / ratio);
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, targetW, targetH);
  const scale = Math.max(targetW / img.width, targetH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (targetW - w) / 2, (targetH - h) / 2, w, h);
  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Circular crop returning a PNG data URL. */
async function circlePng(src: string, size = 600): Promise<string> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const scale = Math.max(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  ctx.restore();
  return canvas.toDataURL("image/png");
}

export type BoardResult = { lowRes: boolean };

export async function downloadDisplayBoard(opts: {
  vehicle: GarageVehicle;
  owner: BoardOwner;
  lang: "en" | "af";
}): Promise<BoardResult> {
  const { vehicle: v, owner, lang } = opts;
  const af = lang === "af";
  let lowRes = false;

  const doc = new jsPDF({ unit: "mm", format: [W, H], orientation: "portrait" });

  // Paper
  doc.setFillColor(PAPER);
  doc.rect(0, 0, W, H, "F");

  // ---- Header band -------------------------------------------------------
  const headerH = 96;
  doc.setFillColor(INK);
  doc.rect(0, 0, W, headerH, "F");

  const faceSrc = owner.avatar_url;
  if (faceSrc) {
    try {
      const face = await circlePng(faceSrc);
      const d = 62;
      doc.addImage(face, "PNG", M, (headerH - d) / 2, d, d);
    } catch {
      /* skip portrait */
    }
  }

  doc.setTextColor(PAPER);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(52);
  doc.text("JUST WHEELS", W - M, 46, { align: "right" });
  doc.setTextColor(RED);
  doc.setFontSize(26);
  doc.text("HESSEQUA", W - M, 72, { align: "right" });

  // ---- Hero photo --------------------------------------------------------
  const heroTop = headerH + 24;
  const heroH = 330;
  const heroW = W - M * 2;
  const heroPhoto = v.photos.find((p) => p.url)?.url ?? null;
  if (heroPhoto) {
    try {
      const img = await loadImage(heroPhoto);
      if (img.naturalWidth < 1000) lowRes = true;
      const data = await coverJpeg(heroPhoto, heroW / heroH);
      doc.addImage(data, "JPEG", M, heroTop, heroW, heroH);
    } catch {
      doc.setFillColor(INK);
      doc.rect(M, heroTop, heroW, heroH, "F");
    }
  } else {
    doc.setFillColor(INK);
    doc.rect(M, heroTop, heroW, heroH, "F");
  }
  doc.setDrawColor(INK);
  doc.setLineWidth(2);
  doc.rect(M, heroTop, heroW, heroH);

  // ---- Title block -------------------------------------------------------
  let y = heroTop + heroH + 44;
  const title = [v.make, v.model].filter(Boolean).join(" ").toUpperCase() || "MY RIDE";
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(58);
  const yearTxt = v.year ? String(v.year) : "";
  const yearW = yearTxt ? doc.getTextWidth(yearTxt) : 0;
  let titleSize = 58;
  while (titleSize > 26 && doc.getTextWidth(title) > heroW - yearW - 20) {
    titleSize -= 2;
    doc.setFontSize(titleSize);
  }
  doc.text(title, M, y);
  if (yearTxt) {
    doc.setTextColor(RED);
    doc.setFontSize(58);
    doc.text(yearTxt, W - M, y, { align: "right" });
  }

  y += 20;
  const sub = [
    v.nickname ? `"${v.nickname}"` : null,
    owner.display_name,
    owner.town,
  ]
    .filter(Boolean)
    .join("   ·   ");
  doc.setTextColor(INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(20);
  doc.text(sub, M, y);

  y += 16;
  doc.setDrawColor(RED);
  doc.setLineWidth(1.6);
  doc.line(M, y, W - M, y);

  // ---- Spec table --------------------------------------------------------
  const rows = specRows(v, af);
  const footerTop = H - 86;
  y += 26;

  if (rows.length === 0) {
    // No structured specs yet — fall back to the vehicle story so the board is never blank.
    const story = (af ? v.story_af || v.story : v.story) || "";
    doc.setTextColor(INK);
    doc.setFont("helvetica", "normal");
    const text = story
      ? story
      : af
        ? "Voeg spesifikasies by in My Garage > Wysig voertuig > Spesifikasieblad."
        : "Add specs in My Garage > Edit vehicle > Spec sheet.";
    // Scale the copy up until it fills the panel without spilling into the footer.
    const boxH = footerTop - y - 14;
    let size = 30;
    let lines: string[] = [];
    for (; size >= 11; size -= 1) {
      doc.setFontSize(size);
      lines = doc.splitTextToSize(text, heroW) as string[];
      const step = size * 0.3528 * 1.45;
      if (lines.length * step <= boxH) break;
    }
    doc.setFontSize(size);
    doc.text(lines, M, y, { lineHeightFactor: 1.45 });
  } else {
    const cols = rows.length > 9 ? 2 : 1;
    const colW = cols === 2 ? (heroW - 24) / 2 : heroW;
    const perCol = Math.ceil(rows.length / cols);
    const available = footerTop - y - 10;
    const rowH = Math.min(30, Math.max(16, available / perCol));
    const labelSize = Math.min(14, Math.max(10, rowH * 0.42));
    const valueSize = Math.min(18, Math.max(11, rowH * 0.55));

    rows.forEach((row, i) => {
      const col = Math.floor(i / perCol);
      const idx = i % perCol;
      const x = M + col * (colW + 24);
      const ry = y + idx * rowH;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(labelSize);
      doc.setTextColor(RED);
      doc.text(row.label.toUpperCase(), x, ry);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(valueSize);
      doc.setTextColor(INK);
      const value = doc.splitTextToSize(row.value, colW)[0] as string;
      doc.text(value, x, ry + valueSize * 0.42 + 2);

      doc.setDrawColor(20, 14, 12);
      doc.setLineWidth(0.3);
      doc.line(x, ry + rowH - 7, x + colW, ry + rowH - 7);
    });
  }

  // ---- Footer ------------------------------------------------------------
  doc.setFillColor(INK);
  doc.rect(0, footerTop, W, H - footerTop, "F");

  const numTxt = owner.member_number
    ? `${af ? "LIDNOMMER" : "MEMBER NO."}  #${String(owner.member_number).padStart(4, "0")}`
    : "";
  doc.setTextColor(PAPER);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(numTxt, M, footerTop + 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(200, 190, 178);
  doc.text("justwheels.co.za", M, footerTop + 60);

  try {
    const logo = await circlePng(LOGO_URL, 800);
    const d = 62;
    doc.addImage(logo, "PNG", W - M - d, footerTop + (H - footerTop - d) / 2, d, d);
  } catch {
    /* skip logo */
  }

  const slug =
    [v.year, v.make, v.model].filter(Boolean).join("-").toLowerCase().replace(/[^a-z0-9-]+/g, "-") ||
    "vehicle";
  doc.save(`just-wheels-board-${slug}.pdf`);

  return { lowRes };
}
