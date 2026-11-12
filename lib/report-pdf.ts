import { PDFDocument, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  reportRegularFont,
  reportBoldFont,
  reportCompactRegularFont,
  reportCompactBoldFont,
} from "./report-fonts";
import { reportTopics, type Report } from "./domain";
export { REPORT_PDF_TEMPLATE, reportPdfName } from "./report-metadata";
export type PdfContext = {
  studentName: string;
  chapterTitle: string;
  revision: number;
  publishedAt: string;
  documents: { id: string; name: string }[];
};
const decode = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
let regularBytes: Uint8Array | undefined,
  boldBytes: Uint8Array | undefined,
  compactRegularBytes: Uint8Array | undefined,
  compactBoldBytes: Uint8Array | undefined;
const colors = {
  ink: rgb(0.09, 0.15, 0.23),
  muted: rgb(0.36, 0.42, 0.5),
  teal: rgb(0.08, 0.18, 0.29),
  lavender: rgb(0.22, 0.39, 0.55),
  line: rgb(0.82, 0.86, 0.89),
  wash: rgb(0.94, 0.96, 0.96),
  green: rgb(0.2, 0.43, 0.3),
};
const clean = (s: unknown) =>
  String(s ?? "")
    .normalize("NFC")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .replace(/\t/g, "    ");
function frenchDate(value: string, full = false) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: value.length > 10 ? "Europe/Paris" : "UTC",
    ...(full
      ? {
          weekday: "long" as const,
          day: "numeric" as const,
          month: "long" as const,
          year: "numeric" as const,
        }
      : {
          day: "2-digit" as const,
          month: "2-digit" as const,
          year: "numeric" as const,
        }),
  }).format(new Date(value.length > 10 ? value : value + "T12:00:00Z"));
}
export async function renderReportPdf(
  report: Report,
  context: PdfContext,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const printed = [
    ...(report.performances || []).map(p => p.title),
    report.title,
    context.studentName,
    context.chapterTitle,
    report.comment,
    ...Object.values(report.summary || {}),
    ...report.activities.map(a=>a.evidence || ""),
    ...report.skills.map(s=>s.group || ""),
    report.assessmentTitle,
    ...report.activities.flatMap((a) => [
      report.skills.find((s) => s.id === a.skillId)?.label || a.skillId,
      a.workRef,
      a.exercises,
    ]),
    ...context.documents
      .filter((d) => report.documentIds.includes(d.id))
      .map((d) => d.name),
  ].join(" ");
  const compact = [...printed].every((c) => {
    const n = c.codePointAt(0)!;
    return (
      n <= 0x04ff ||
      (n >= 0x1d00 && n <= 0x23ff) ||
      (n >= 0x25a0 && n <= 0x25ff)
    );
  });
  if (compact) {
    compactRegularBytes ??= decode(reportCompactRegularFont);
    compactBoldBytes ??= decode(reportCompactBoldFont);
  } else {
    regularBytes ??= decode(reportRegularFont);
    boldBytes ??= decode(reportBoldFont);
  }
  const regular = await pdf.embedFont(
      compact ? compactRegularBytes! : regularBytes!,
      { subset: false, features: { liga: false } },
    ),
    bold = await pdf.embedFont(compact ? compactBoldBytes! : boldBytes!, {
      subset: false,
      features: { liga: false },
    });
  pdf.setTitle("Bilan de séance - " + clean(report.title));
  pdf.setSubject(clean(context.chapterTitle) + " - " + report.date);
  pdf.setAuthor("Repère");
  pdf.setCreator("Repère - modèle de bilan de séance");
  pdf.setProducer("Repère");
  const created = new Date(context.publishedAt);
  if (!Number.isNaN(+created)) {
    pdf.setCreationDate(created);
    pdf.setModificationDate(created);
  }
  const W = 595.28,
    H = 841.89,
    M = 46,
    CW = W - 2 * M,
    BOTTOM = 64;
  let page!: PDFPage,
    y = 0;
  function addPage() {
    page = pdf.addPage([W, H]);
    y = H - 92;
    page.drawRectangle({x:M,y:H-52,width:23,height:23,color:colors.ink});
    page.drawText('R',{x:M+5,y:H-46,font:bold,size:16,color:rgb(1,1,1)});
    page.drawText("Repère", {
      x: M + 36,
      y: H - 45,
      size: 13,
      font: bold,
      color: colors.ink,
    });
    page.drawText("SUIVI EN MATHÉMATIQUES", {
      x: W - M - 159,
      y: H - 42,
      size: 7,
      font: regular,
      color: colors.muted,
    });
    page.drawLine({
      start: { x: M, y: H - 61 },
      end: { x: W - M, y: H - 61 },
      color: colors.line,
      thickness: 0.65,
    });
  }
  function ensure(height: number) {
    if (y - height < BOTTOM) addPage();
  }
  function lines(text: string, font: PDFFont, size: number, maxWidth: number) {
    const out: string[] = [];
    for (const paragraph of clean(text).split("\n")) {
      if (!paragraph) {
        out.push("");
        continue;
      }
      let current = "";
      for (const word of paragraph.split(/\s+/)) {
        const candidate = current ? current + " " + word : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
          current = candidate;
          continue;
        }
        if (current) {
          out.push(current);
          current = "";
        }
        let piece = "";
        for (const ch of word) {
          if (piece && font.widthOfTextAtSize(piece + ch, size) > maxWidth) {
            out.push(piece);
            piece = "";
          }
          piece += ch;
        }
        current = piece;
      }
      out.push(current);
    }
    return out;
  }
  function write(
    text: string,
    opts: {
      size?: number;
      strong?: boolean;
      color?: ReturnType<typeof rgb>;
      indent?: number;
      gap?: number;
      leading?: number;
    } = {},
  ) {
    const size = opts.size ?? 10,
      font = opts.strong ? bold : regular,
      indent = opts.indent ?? 0,
      leading = opts.leading ?? size * 1.35;
    for (const line of lines(text, font, size, CW - indent)) {
      ensure(leading);
      if (line)
        page.drawText(line, {
          x: M + indent,
          y: y - size,
          font,
          size,
          color: opts.color ?? colors.ink,
        });
      y -= leading;
    }
    y -= opts.gap ?? 0;
  }
  function section(title: string) {
    ensure(32);
    y -= 4;
    write(title, { size: 9, strong: true, color: colors.teal, gap: 3 });
    page.drawLine({
      start: { x: M, y: y + 1 },
      end: { x: W - M, y: y + 1 },
      color: colors.line,
      thickness: 0.6,
    });
    y -= 8;
  }
  addPage();
  write("BILAN DE SÉANCE", {size:8,strong:true,color:colors.teal,gap:5});
  const date = frenchDate(report.date, true);
  write(date.charAt(0).toUpperCase() + date.slice(1), {size:9,color:colors.muted,gap:6});
  write(report.title, {size:19,strong:true,leading:24,gap:8});
  write(context.studentName + "  /  " + context.chapterTitle, {size:9,strong:true,gap:14});
  if (report.summary) {
    for (const [key, title] of [["objective","Objectif"],["strengths","Points réussis"],["focus","À consolider"],["nextStep","Prochaine étape"]] as const) {
      if (!report.summary[key]?.trim()) continue;
      ensure(52);
      write(title.toUpperCase(), {size:7,strong:true,color:key === "strengths" ? colors.green : colors.teal,gap:2});
      write(report.summary[key], {size:8.7,leading:12,gap:7});
    }
  }
  if (report.comment.trim()) {
    section(report.summary ? "Repères de lecture" : "Synthèse du professeur");
    write(report.comment, {size:8.5,leading:12,gap:6});
  }
  section("Objectifs travaillés");
  const topics = reportTopics(report);
  for (const topic of topics) {
    ensure(56);
    write(topic.title, {size:9,strong:true,gap:2});
    write(topic.level === null ? "Travaillé - non évalué" : `${topic.level} % - ${topic.evaluated > 1 ? "moyenne de " : ""}${topic.evaluated} notion${topic.evaluated>1?"s":""} évaluée${topic.evaluated>1?"s":""} sur ${topic.items.length}${topic.estimated ? " (estimation)" : ""}`, {size:8.5,color:topic.level===100?colors.green:colors.muted,gap:6});
  }
  if (report.score !== null && report.scale !== null) {
    section("Résultat d’évaluation");
    if (report.assessmentTitle)
      write(report.assessmentTitle, { size: 10, strong: true, gap: 5 });
    write(`Note : ${report.score} / ${report.scale}`, {
      size: 14,
      strong: true,
      color: colors.lavender,
      gap: 8,
    });
  }
  if (report.assessmentMinutes) write(`Durée du contrôle : ${report.assessmentMinutes} min`, {size:10,gap:8});
  if (report.performances?.length) {
    section("Résultats et temps mesurés");
    for (const p of report.performances) {
      ensure(32);
      write(p.title, {size:8.5,strong:true,gap:1});
      write((p.type === "td" ? "TD" : p.type === "evaluation" ? "Évaluation" : "Exercice") + (p.score !== null ? ` - Note : ${p.score} / ${p.scale}` : "") + (p.minutes !== null ? ` - Temps : ${p.minutes} min` : ""), {size:8,gap:6});
    }
  }
  const attachments = context.documents.filter((d) =>
    report.documentIds.includes(d.id),
  );
  if (attachments.length) {
    y -= 7;
    write("Supports joints : " + attachments.map((d) => d.name).join(" ; "), {
      size: 8.5,
      color: colors.muted,
      gap: 4,
    });
  }
  if (topics.length) {
    addPage();
    const writtenEvidence = new Set<string>();
    section("Détail des compétences de la séance");
    write("Les niveaux ci-dessous concernent cette séance. Une estimation pédagogique ne renseigne pas le degré d’aide reçu.", {size:8,color:colors.muted,gap:12});
    for (const topic of topics) {
      ensure(46);
      write(topic.title, {size:9,strong:true,color:colors.teal,gap:8});
      for (const {skill} of topic.items) {
        for (const a of report.activities.filter(a=>a.skillId===skill.id)) {
        ensure(42);
        write(skill.label, {size:8.5,strong:true,gap:1});
        write(a.level === null ? "Non évaluée" : `${a.level} %${a.estimated ? " - estimation pédagogique" : a.level===100 ? " - Réussite observée sur les exercices travaillés" : ""}`, {size:8.5,color:a.level===100?colors.green:colors.lavender,gap:1});
        if (a.workRef) write("Support : " + a.workRef, {size:8,color:colors.muted,gap:3});
        if (a.evidence && !writtenEvidence.has(a.evidence)) {
          write(a.evidence, {size:8,color:colors.muted,gap:3});
          writtenEvidence.add(a.evidence);
        }
        if (a.exercises) write("Exercices : " + a.exercises, {size:8,color:colors.muted,gap:3});
        y -= 4;
        }
      }
    }
  }
  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    p.drawLine({
      start: { x: M, y: 47 },
      end: { x: W - M, y: 47 },
      color: colors.line,
      thickness: 0.6,
    });
    p.drawText(
      `Publié le ${frenchDate(context.publishedAt)} - Version ${context.revision}`,
      { x: M, y: 32, size: 7.3, font: regular, color: colors.muted },
    );
    p.drawText(`${i + 1} / ${pages.length}`, {
      x: W - M - 28,
      y: 32,
      size: 7.5,
      font: regular,
      color: colors.muted,
    });
  }
  return pdf.save();
}
