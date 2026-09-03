// Generates optimized, web-ready derivatives from the untouched logo source.
// Does NOT redraw or alter the lotus geometry / wordmark — it only trims
// surrounding whitespace, crops a mark region, and re-encodes at web sizes.
// Run: npm run logo:optimize
import sharp from "sharp";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandDir = path.join(repoRoot, "frontend", "public", "brand");
const source = path.join(brandDir, "bronxville-natural-market-logo-source.png");

if (!existsSync(source)) {
  console.error(`Logo source not found at ${source}`);
  process.exit(1);
}

async function run() {
  const meta = await sharp(source).metadata();
  console.log(`Source: ${meta.width}x${meta.height} (${meta.format})`);

  // Full logo: trim uniform white border, cap width for the web.
  await sharp(source)
    .trim({ threshold: 12 })
    .resize({ width: 640, withoutEnlargement: true })
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(path.join(brandDir, "bronxville-natural-market-logo.png"));

  // Compact mark: crop the arc + lotus + leaves region (above the wordmark),
  // then trim residual whitespace. Percentages keep this robust to the
  // 751x751 source without hand-tuning pixels.
  const w = meta.width ?? 751;
  const h = meta.height ?? 751;
  const markCrop = {
    left: Math.round(w * 0.11),
    top: Math.round(h * 0.07),
    width: Math.round(w * 0.78),
    height: Math.round(h * 0.64),
  };
  await sharp(source)
    .extract(markCrop)
    .trim({ threshold: 12 })
    .resize({ width: 256, withoutEnlargement: true })
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(path.join(brandDir, "bronxville-natural-market-mark.png"));

  // Small favicon-friendly mark.
  await sharp(source)
    .extract(markCrop)
    .trim({ threshold: 12 })
    .resize(64, 64, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(brandDir, "mark-64.png"));

  const out = await sharp(
    path.join(brandDir, "bronxville-natural-market-logo.png"),
  ).metadata();
  const mark = await sharp(
    path.join(brandDir, "bronxville-natural-market-mark.png"),
  ).metadata();
  console.log(`Full logo derivative: ${out.width}x${out.height}`);
  console.log(`Mark derivative:      ${mark.width}x${mark.height}`);
  console.log("Done. Visually verify derivatives against the source.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
