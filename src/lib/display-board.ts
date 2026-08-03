/**
 * Exhibition display board — 600 x 400 mm landscape PDF.
 * Printed and propped next to the car at shows.
 * Client-side only (uses canvas + jsPDF).
 */
import { jsPDF } from "jspdf";
import type { GarageVehicle } from "@/lib/garage.functions";
import { LOGO_URL } from "@/lib/brand";

const W = 600;
const H = 400;
const M = 26; // margin

const INK = "#140e0c";
const PAPER = "#ffffff";
const MUTED = "#8a8078";
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
  ctx.fillStyle = "#ffffff";
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

  const doc = new jsPDF({ unit: "mm", format: [W, H], orientation: "landscape" });

  // Paper — all white
  doc.setFillColor(PAPER);
  doc.rect(0, 0, W, H, "F");

  // ---- Header (no band) --------------------------------------------------
  const headerBase = M + 26;
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.text("JUST WHEELS", M, headerBase);
  const jwW = doc.getTextWidth("JUST WHEELS");
  doc.setTextColor(RED);
  doc.setFontSize(18);
  doc.text("HESSEQUA", M + jwW + 8, headerBase);

  const numTxt = owner.member_number
    ? `${af ? "LIDNOMMER" : "MEMBER NO."}  #${String(owner.member_number).padStart(4, "0")}`
    : "";
  if (numTxt) {
    doc.setTextColor(INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(numTxt, W - M, headerBase, { align: "right" });
  }

  const headerRule = headerBase + 8;
  doc.setDrawColor(RED);
  doc.setLineWidth(1.2);
  doc.line(M, headerRule, W - M, headerRule);

  // ---- Columns -----------------------------------------------------------
  const footerTop = H - 46;
  const bodyTop = headerRule + 16;
  const bodyH = footerTop - 14 - bodyTop;
  const gap = 20;
  const leftW = Math.round((W - M * 2 - gap) * 0.52);
  const rightX = M + leftW + gap;
  const rightW = W - M - rightX;

  // ---- Hero photo (left) -------------------------------------------------
  const heroPhoto = v.photos.find((p) => p.url)?.url ?? null;
  let drew = false;
  if (heroPhoto) {
    try {
      const img = await loadImage(heroPhoto);
      if (img.naturalWidth < 1000) lowRes = true;
      const data = await coverJpeg(heroPhoto, leftW / bodyH);
      doc.addImage(data, "JPEG", M, bodyTop, leftW, bodyH);
      drew = true;
    } catch {
      /* placeholder below */
    }
  }
  if (!drew) {
    doc.setFillColor(238, 234, 229);
    doc.rect(M, bodyTop, leftW, bodyH, "F");
  }
  doc.setDrawColor(INK);
  doc.setLineWidth(0.8);
  doc.rect(M, bodyTop, leftW, bodyH);

  // ---- Title block (right) ----------------------------------------------
  let y = bodyTop + 20;
  const title = [v.make, v.model].filter(Boolean).join(" ").toUpperCase() || "MY RIDE";
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  let titleSize = 34;
  doc.setFontSize(titleSize);
  const yearTxt = v.year ? String(v.year) : "";
  doc.setFontSize(24);
  const yearW = yearTxt ? doc.getTextWidth(yearTxt) + 12 : 0;
  doc.setFontSize(titleSize);
  while (titleSize > 14 && doc.getTextWidth(title) > rightW - yearW) {
    titleSize -= 1;
    doc.setFontSize(titleSize);
  }
  doc.text(title, rightX, y);
  if (yearTxt) {
    doc.setTextColor(RED);
    doc.setFontSize(24);
    doc.text(yearTxt, W - M, y, { align: "right" });
  }

  y += 13;
  const sub = [v.nickname ? `"${v.nickname}"` : null, owner.display_name, owner.town]
    .filter(Boolean)
    .join("   ·   ");
  if (sub) {
    doc.setTextColor(INK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.text(sub, rightX, y);
  }

  y += 8;
  doc.setDrawColor(RED);
  doc.setLineWidth(1);
  doc.line(rightX, y, W - M, y);

  // ---- Spec table --------------------------------------------------------
  const rows = specRows(v, af);
  y += 16;
  const panelBottom = bodyTop + bodyH;

  if (rows.length === 0) {
    const story = (af ? v.story_af || v.story : v.story) || "";
    doc.setTextColor(INK);
    doc.setFont("helvetica", "normal");
    const text = story
      ? story
      : af
        ? "Voeg spesifikasies by in My Garage > Wysig voertuig > Spesifikasieblad."
        : "Add specs in My Garage > Edit vehicle > Spec sheet.";
    const boxH = panelBottom - y;
    let size = 20;
    let lines: string[] = [];
    for (; size >= 9; size -= 1) {
      doc.setFontSize(size);
      lines = doc.splitTextToSize(text, rightW) as string[];
      const step = size * 0.3528 * 1.45;
      if (lines.length * step <= boxH) break;
    }
    doc.setFontSize(size);
    doc.text(lines, rightX, y, { lineHeightFactor: 1.45 });
  } else {
    const cols = rows.length > 8 ? 2 : 1;
    const colGap = 14;
    const colW = cols === 2 ? (rightW - colGap) / 2 : rightW;
    const perCol = Math.ceil(rows.length / cols);
    const available = panelBottom - y;
    const rowH = Math.min(26, Math.max(12, available / perCol));
    const labelSize = Math.min(9, Math.max(6.5, rowH * 0.34));
    const valueSize = Math.min(13, Math.max(8, rowH * 0.45));

    rows.forEach((row, i) => {
      const col = Math.floor(i / perCol);
      const idx = i % perCol;
      const x = rightX + col * (colW + colGap);
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

      doc.setDrawColor(220, 214, 208);
      doc.setLineWidth(0.3);
      doc.line(x, ry + rowH - 5, x + colW, ry + rowH - 5);
    });
  }

  // ---- Footer (white, thin rule) -----------------------------------------
  doc.setDrawColor(220, 214, 208);
  doc.setLineWidth(0.6);
  doc.line(M, footerTop, W - M, footerTop);

  const footMid = footerTop + (H - footerTop) / 2;
  let textX = M;
  const faceSrc = owner.avatar_url;
  if (faceSrc) {
    try {
      const face = await circlePng(faceSrc);
      const d = 26;
      doc.addImage(face, "PNG", M, footMid - d / 2, d, d);
      textX = M + d + 8;
    } catch {
      /* skip portrait */
    }
  }

  doc.setTextColor(MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("justwheels.co.za", textX, footMid + 4);

  try {
    const logo = await circlePng(LOGO_URL, 800);
    const d = 30;
    doc.addImage(logo, "PNG", W - M - d, footMid - d / 2, d, d);
  } catch {
    /* skip logo */
  }

  const slug =
    [v.year, v.make, v.model].filter(Boolean).join("-").toLowerCase().replace(/[^a-z0-9-]+/g, "-") ||
    "vehicle";
  doc.save(`just-wheels-board-${slug}.pdf`);

  return { lowRes };
}

