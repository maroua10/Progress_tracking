import type { Report } from "./domain";
export const REPORT_PDF_TEMPLATE = "repere-bilan-v4";
export function reportPdfName(report: Report, revision: number) {
  return `Bilan - ${report.date} - ${(report.title || "Séance").replace(/[\x00-\x1f<>"/\\]/g, "").slice(0, 95)} - v${revision}.pdf`;
}
