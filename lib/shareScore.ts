// "Share your score": a 1080×1920 image (the WhatsApp Status shape) drawn on a
// canvas in the browser, shared with the Web Share API where the phone
// supports files, otherwise as a WhatsApp message plus a downloadable image.

export interface ScoreCard {
  /** Big number on the card, e.g. "3/5" or "72%". */
  headline: string;
  /** Line under it, e.g. "Today's daily challenge". */
  label: string;
  /** Small line, e.g. "Physics · 25 Nov". */
  detail?: string;
  /** Days in a row; shown when 2 or more. */
  streak?: number;
  /** The message that goes with the image. */
  text: string;
}

const W = 1080;
const H = 1920;
const NAVY = "#08111f";
const BLUE = "#1a91f0";
const MINT = "#16b985";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// next/font renames the face, so take the family the page actually uses.
let FAMILY = "system-ui, sans-serif";

/** Shrinks the font until `text` fits in `maxWidth`. */
function fitText(ctx: CanvasRenderingContext2D, text: string, weight: string, size: number, maxWidth: number) {
  let s = size;
  ctx.font = `${weight} ${s}px ${FAMILY}`;
  while (s > 24 && ctx.measureText(text).width > maxWidth) {
    s -= 4;
    ctx.font = `${weight} ${s}px ${FAMILY}`;
  }
}

export async function renderScoreCard(card: ScoreCard, siteHost: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  await document.fonts?.ready;
  FAMILY = getComputedStyle(document.body).fontFamily || FAMILY;

  // Background: navy with the brand's blue-to-green glow.
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.5, H * 0.42, 40, W * 0.5, H * 0.42, W * 0.95);
  glow.addColorStop(0, "rgba(26,145,240,0.45)");
  glow.addColorStop(0.55, "rgba(22,185,133,0.18)");
  glow.addColorStop(1, "rgba(8,17,31,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const logo = await loadImage("/brand/logo-dark.svg");
  if (logo) ctx.drawImage(logo, W / 2 - 120, 170, 240, 238);

  // Headline score with a gradient fill.
  fitText(ctx, card.headline, "800", 300, W - 160);
  const grad = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, 0);
  grad.addColorStop(0, BLUE);
  grad.addColorStop(1, MINT);
  ctx.fillStyle = grad;
  ctx.fillText(card.headline, W / 2, 900);

  ctx.fillStyle = "#ffffff";
  fitText(ctx, card.label, "700", 64, W - 160);
  ctx.fillText(card.label, W / 2, 1010);

  if (card.detail) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    fitText(ctx, card.detail, "500", 44, W - 160);
    ctx.fillText(card.detail, W / 2, 1085);
  }

  if (card.streak && card.streak >= 2) {
    const pill = `🔥 ${card.streak}-day streak`;
    ctx.font = `700 52px ${FAMILY}`;
    const pw = ctx.measureText(pill).width + 96;
    ctx.fillStyle = "rgba(245,158,11,0.16)";
    ctx.beginPath();
    ctx.roundRect(W / 2 - pw / 2, 1180, pw, 100, 50);
    ctx.fill();
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(pill, W / 2, 1248);
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 48px ${FAMILY}`;
  ctx.fillText("Can you beat it?", W / 2, 1600);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `500 40px ${FAMILY}`;
  ctx.fillText(`JAMB past questions and CBT practice · ${siteHost}`, W / 2, 1670);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not draw the image"))), "image/png"),
  );
}

export type ShareOutcome = "shared" | "cancelled" | "fallback";

/**
 * Native share sheet with the image where the browser can share files
 * (most phones). Call it straight from the tap, with the image already drawn.
 * Anything but "shared" means the caller should offer WhatsApp and a
 * download: AbortError covers both "closed the sheet" and "nowhere to share",
 * so it can't be treated as a plain cancel.
 */
export async function shareScoreCard(card: ScoreCard, image: Blob): Promise<ShareOutcome> {
  const file = new File([image], "acadmate-score.png", { type: "image/png" });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: card.text });
      return "shared";
    } catch (err) {
      return (err as Error)?.name === "AbortError" ? "cancelled" : "fallback";
    }
  }
  return "fallback";
}

export function whatsappShareLink(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
