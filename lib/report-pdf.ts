import { PDFDocument, rgb, degrees, type PDFPage, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  reportRegularFont,
  reportBoldFont,
  reportCompactRegularFont,
  reportCompactBoldFont,
} from "./report-fonts";
import { levelLabels, type Report, type Activity } from "./domain";
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
      leading = opts.leading ?? size * 1.48;
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
    ensure(46);
    y -= 8;
    write(title, { size: 10, strong: true, color: colors.teal, gap: 5 });
    page.drawLine({
      start: { x: M, y: y + 1 },
      end: { x: W - M, y: y + 1 },
      color: colors.line,
      thickness: 0.6,
    });
    y -= 12;
  }
  addPage();
  write("BILAN DE SÉANCE", {
    size: 8,
    strong: true,
    color: colors.teal,
    gap: 9,
  });
  const date = frenchDate(report.date, true);
  write(date.charAt(0).toUpperCase() + date.slice(1), {
    size: 10,
    color: colors.muted,
    gap: 8,
  });
  write(report.title, { size: 21, strong: true, leading: 27, gap: 12 });
  write("Élève : " + context.studentName, { size: 10, gap: 3 });
  write("Chapitre : " + context.chapterTitle, {
    size: 11,
    strong: true,
    gap: 4,
  });
  write("Mathématiques - Durée : 2 h", {
    size: 8.5,
    color: colors.muted,
    gap: 15,
  });
  const worked = new Set(report.activities.map((a) => a.skillId)).size,
    evaluated = new Set(
      report.activities.filter((a) => a.level !== null).map((a) => a.skillId),
    ).size;
  ensure(39);
  page.drawRectangle({
    x: M,
    y: y - 32,
    width: CW,
    height: 32,
    color: colors.wash,
  });
  page.drawText(
    `${worked} notion${worked > 1 ? "s" : ""} travaillée${worked > 1 ? "s" : ""}   /   ${evaluated} notion${evaluated > 1 ? "s" : ""} évaluée${evaluated > 1 ? "s" : ""}`,
    { x: M + 12, y: y - 20, font: regular, size: 9, color: colors.ink },
  );
  y -= 43;
  if (report.partial)
    write(
      "Reprise d’historique partiel : seules les informations connues sont renseignées.",
      { size: 9, color: colors.muted, gap: 6 },
    );
  section("Notions et activités");
  const groups = new Map<string, Activity[]>();
  for (const a of report.activities)
    groups.set(a.skillId, [...(groups.get(a.skillId) || []), a]);
  let index = 0;
  for (const [skillId, activities] of groups) {
    ensure(70);
    const skill = report.skills.find((s) => s.id === skillId);
    write(`${String(++index).padStart(2, "0")}  ${skill?.label || skillId}`, {
      size: 10.5,
      strong: true,
      leading: 15,
      gap: 6,
    });
    for (const a of activities) {
      const type = { cours: "Cours", td: "TD", evaluation: "Évaluation" }[
        a.type
      ];
      write(
        `${type} - ${a.level === null ? "Non évaluée" : a.level + " % de maîtrise observée"}`,
        {
          size: 9.5,
          indent: 16,
          color: a.level === 100 ? colors.green : colors.ink,
          gap: 3,
        },
      );
      if (a.level !== null)
        write(levelLabels[String(a.level)], {
          size: 8.5,
          indent: 16,
          color: colors.muted,
          gap: 3,
        });
      if (!a.workId && a.workRef)
        write("Support : " + a.workRef, { size: 9, indent: 16, gap: 2 });
      if (a.exercises)
        write("Exercices : " + a.exercises, { size: 9, indent: 16, gap: 3 });
      y -= 6;
    }
    y -= 5;
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
      write(p.title, {size:10,strong:true,gap:4});
      write((p.type === "td" ? "TD" : p.type === "evaluation" ? "Évaluation" : "Exercice") + (p.score !== null ? ` - Note : ${p.score} / ${p.scale}` : "") + (p.minutes !== null ? ` - Temps : ${p.minutes} min` : ""), {size:9,gap:8});
    }
  }
  if (report.comment.trim()) {
    section("Commentaire du professeur");
    write(report.comment, { size: 10, leading: 15, gap: 8 });
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
