import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const dir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/posts/2026-10-26-sample"
);

const cover = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0%" stop-color="#F8E7D4"/>
      <stop offset="46%" stop-color="#F0C19A"/>
      <stop offset="100%" stop-color="#E08A66"/>
    </linearGradient>
    <radialGradient id="sun" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFF6E8"/>
      <stop offset="48%" stop-color="#FFD7A4" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#FFD7A4" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="1200" fill="url(#sky)"/>
  <circle cx="1180" cy="300" r="320" fill="url(#sun)"/>
  <ellipse cx="430" cy="760" rx="260" ry="210" fill="#C4623E" fill-opacity="0.22"/>
  <ellipse cx="860" cy="1040" rx="980" ry="250" fill="#9A432C" fill-opacity="0.28"/>
  <ellipse cx="1180" cy="980" rx="420" ry="150" fill="#FFF4E8" fill-opacity="0.28"/>
  <path d="M140 690 C 360 620, 520 760, 760 700" fill="none" stroke="#FFF8F1" stroke-opacity="0.55" stroke-width="16" stroke-linecap="round"/>
  <path d="M180 760 C 390 700, 540 820, 800 760" fill="none" stroke="#FFF8F1" stroke-opacity="0.28" stroke-width="12" stroke-linecap="round"/>
  <circle cx="250" cy="250" r="22" fill="#8C3B24" fill-opacity="0.55"/>
  <circle cx="292" cy="236" r="14" fill="#8C3B24" fill-opacity="0.28"/>
</svg>`;

const figure = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
  <defs>
    <linearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F8E6D6"/>
      <stop offset="100%" stop-color="#C96548"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="1200" fill="url(#wash)"/>
  <circle cx="520" cy="640" r="300" fill="#FFF6EE" fill-opacity="0.55"/>
  <circle cx="1040" cy="520" r="240" fill="#8C3B24" fill-opacity="0.28"/>
  <circle cx="860" cy="820" r="180" fill="#E7A27A" fill-opacity="0.55"/>
  <circle cx="1180" cy="860" r="90" fill="#FFF8F3" fill-opacity="0.7"/>
  <rect x="180" y="280" width="220" height="420" rx="110" fill="#A24B32" fill-opacity="0.16"/>
  <path d="M160 980 H1440" fill="none" stroke="#FFF8F3" stroke-opacity="0.45" stroke-width="10" stroke-linecap="round"/>
</svg>`;

await sharp(Buffer.from(cover)).jpeg({ quality: 92, mozjpeg: true }).toFile(path.join(dir, "cover.jpg"));
await sharp(Buffer.from(figure)).jpeg({ quality: 92, mozjpeg: true }).toFile(path.join(dir, "figure.jpg"));

const icon = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#8C3B24"/>
  <text x="32" y="46" text-anchor="middle" font-family="Noto Sans CJK SC" font-size="40" font-weight="700" fill="#FFF8F3">莲</text>
</svg>`;
await sharp(Buffer.from(icon)).png().toFile(path.resolve(dir, "../../favicon.png"));
console.log("wrote sample images");
