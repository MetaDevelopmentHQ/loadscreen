/**
 * MetaDev Loadscreen · logocolors.js
 *
 * Suggests accent colors from a logo:
 *   1. draw the logo small on a canvas
 *   2. quantize pixels into 4-bit-per-channel buckets (4096 colors)
 *   3. score buckets by vividness (saturation, mid lightness, frequency)
 *   4. make sure each pick reads well on the dark background (#07090C),
 *      lightening it if needed, and drop near-duplicates
 *
 * The first suggestion is the recommended accent.
 */

const BACKGROUND = [7, 9, 12]; // #07090C
const MIN_CONTRAST = 4.5;
const SAMPLE_SIZE = 64;

/* ----- Color math -------------------------------------------------------- */

function toHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb([h, s, l]) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function luminance([r, g, b]) {
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a, b = BACKGROUND) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Raises lightness (keeping hue) until the color is readable on the dark background. */
function ensureContrast(rgb) {
  let [h, s, l] = rgbToHsl(rgb);
  let color = rgb;
  while (contrastRatio(color) < MIN_CONTRAST && l < 0.95) {
    l += 0.03;
    color = hslToRgb([h, s, l]);
  }
  return color;
}

function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/* ----- Image loading ----------------------------------------------------- */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Needed to read pixels of remote images (the host must send CORS headers).
    if (/^https:\/\//i.test(src)) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(Object.assign(new Error('load'), { code: 'load' }));
    image.src = src;
  });
}

function readPixels(image) {
  const canvas = document.createElement('canvas');
  const ratio = Math.min(1, SAMPLE_SIZE / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
  canvas.width = Math.max(1, Math.round((image.naturalWidth || SAMPLE_SIZE) * ratio));
  canvas.height = Math.max(1, Math.round((image.naturalHeight || SAMPLE_SIZE) * ratio));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  try {
    return context.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    // The canvas is "tainted": the image came from another origin without CORS.
    throw Object.assign(new Error('cors'), { code: 'cors' });
  }
}

/* ----- Public API -------------------------------------------------------- */

/**
 * @param {string} src  local path (media/…) or https URL
 * @param {number} count number of suggestions
 * @returns {Promise<{hex:string, contrast:number}[]>}
 * @throws {Error & {code:'load'|'cors'}}
 */
export async function extractAccentColors(src, count = 3) {
  const pixels = readPixels(await loadImage(src));

  // Quantize into 4-bit buckets, accumulating real averages per bucket.
  const buckets = new Map();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue; // transparent
    const key = ((pixels[i] >> 4) << 8) | ((pixels[i + 1] >> 4) << 4) | (pixels[i + 2] >> 4);
    const bucket = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    bucket.n += 1; bucket.r += pixels[i]; bucket.g += pixels[i + 1]; bucket.b += pixels[i + 2];
    buckets.set(key, bucket);
  }

  const candidates = [...buckets.values()].map((bucket) => {
    const rgb = [bucket.r / bucket.n, bucket.g / bucket.n, bucket.b / bucket.n];
    const [h, s, l] = rgbToHsl(rgb);
    // Vivid = saturated, not too dark or too light, and actually present in the logo.
    const score = s * (1 - Math.abs(l - 0.55) * 1.4) * Math.log2(bucket.n + 1);
    return { rgb, h, s, l, score };
  }).filter((c) => c.s > 0.25 && c.l > 0.12 && c.l < 0.92)
    .sort((a, b) => b.score - a.score);

  const picks = [];
  for (const candidate of candidates) {
    if (picks.every((p) => hueDistance(p.h, candidate.h) > 24)) picks.push(candidate);
    if (picks.length === count) break;
  }

  return picks.map((pick) => {
    const rgb = ensureContrast(pick.rgb);
    return { hex: toHex(rgb), contrast: Math.round(contrastRatio(rgb) * 10) / 10 };
  });
}
