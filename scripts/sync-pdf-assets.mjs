import { mkdir, copyFile, cp } from "node:fs/promises";
const root = new URL("../", import.meta.url),
  source = new URL("node_modules/pdfjs-dist/", root),
  target = new URL("public/pdf-viewer/", root);
await mkdir(target, { recursive: true });
await copyFile(
  new URL("build/pdf.worker.min.mjs", source),
  new URL("pdf.worker-6.5.438.min.mjs", target),
);
await copyFile(new URL("LICENSE", source), new URL("LICENSE", target));
for (const directory of ["cmaps", "standard_fonts", "wasm"])
  await cp(new URL(directory + "/", source), new URL(directory + "/", target), {
    recursive: true,
  });
console.log("PDF.js : ressources locales prêtes.");
