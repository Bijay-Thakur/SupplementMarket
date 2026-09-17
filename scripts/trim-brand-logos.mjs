import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const directory = process.argv[2];
if (!directory) throw new Error("Brand-logo directory is required.");

for (const name of ["emerita.jpg"]) {
  const source = path.join(directory, name);
  const temporary = `${source}.tmp.jpg`;
  await sharp(source)
    .trim({ background: "#ffffff", threshold: 10 })
    .extend({ top: 30, right: 30, bottom: 30, left: 30, background: "#ffffff" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(temporary);
  await fs.rename(temporary, source);
}
