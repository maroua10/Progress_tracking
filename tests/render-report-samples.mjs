import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
await mkdir("work/pdf-qa", { recursive: true });
await build({
  stdin: {
    contents:
      "export {renderReportPdf,REPORT_PDF_TEMPLATE} from './lib/report-pdf.ts'; export {programme} from './lib/programme.ts';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "work/pdf-qa/renderer.mjs",
});
const { renderReportPdf, programme } = await import(
  pathToFileURL(resolve("work/pdf-qa/renderer.mjs"))
);
const skills = programme.find((p) => p.id === "suites").skills;
const report = {
  date: "2026-11-06",
  title: "EXEMPLE - Suites arithmétiques",
  chapterId: "suites",
  gridId: "exemple",
  skills,
  activities: [
    {
      id: "a",
      skillId: "su-arith-reconnaitre",
      type: "cours",
      level: 75,
      confirmed: false,
      workRef: "Fiche de cours",
      exercises: "1 et 2",
    },
    {
      id: "b",
      skillId: "su-arith-reconnaitre",
      type: "td",
      level: 100,
      confirmed: true,
      workRef: "TD Suites 1",
      exercises: "3 et 4",
    },
    {
      id: "c",
      skillId: "su-arith-general",
      type: "evaluation",
      level: null,
      confirmed: false,
      workRef: "Contrôle sur les suites",
      exercises: "5a et 5b",
    },
  ],
  documentIds: ["support"],
  comment:
    "EXEMPLE - DONNÉES FICTIVES. Ce document illustre le modèle de bilan ; il ne correspond à aucune séance réelle du suivi.",
  score: 8,
  scale: 10,
  assessmentTitle: "Définition et terme général",
  partial: false,
  privateNote: "SECRET STRICTEMENT PRIVE",
};
const context = {
  studentName: "Élève exemple",
  chapterTitle: "Suites numériques",
  revision: 1,
  publishedAt: "2026-11-06T19:00:00.000Z",
  documents: [{ id: "support", name: "TD Suites 1.pdf" }],
};
const out = process.argv[2] || "../orbite-exemple-bilan.pdf";
await writeFile(out, await renderReportPdf(report, context));
const stress = {
  ...report,
  title: "TEST DE MISE EN PAGE - Δ, uₙ₊₁, uₚ et racines réelles",
  comment:
    "Paragraphe long destiné à vérifier la pagination, les accents français et la conservation de chaque information.\n\n".repeat(
      28,
    ),
  activities: Array.from({ length: 15 }, (_, i) => ({
    ...report.activities[i % 3],
    id: String(i),
    skillId: skills[i].id,
    exercises: "Exercices : " + "référence-très-longue-sans-espace-".repeat(10),
  })),
};
await writeFile(
  "work/pdf-qa/stress-bilan.pdf",
  await renderReportPdf(stress, context),
);
console.log(
  JSON.stringify({
    sample: resolve(out),
    stress: resolve("work/pdf-qa/stress-bilan.pdf"),
  }),
);
