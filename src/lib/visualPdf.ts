/** Visuelle PDF-Pipeline: jede ausgewählte Folie wird als natives Bild an das Modell geschickt.
 * Text aus PDF.js bleibt ein ergänzender Hinweis und ist NIE Ersatz für die Bildseiten.
 */
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type {
  StudyDocument,
  VisualPage,
  DocumentVisuals,
} from "../types/domain";
GlobalWorkerOptions.workerSrc = pdfWorker;

function decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
export async function renderVisualPages(
  base64: string,
  fromPage: number,
  toPage: number,
  onProgress?: (done: number, total: number) => void,
): Promise<VisualPage[]> {
  const pdf = await getDocument({ data: decode(base64) }).promise;
  try {
    if (fromPage < 1 || toPage < fromPage || toPage > pdf.numPages)
      throw new Error("PDF-Seitenbereich ungültig");
    const result: VisualPage[] = [];
    for (let pageNo = fromPage; pageNo <= toPage; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const natural = page.getViewport({ scale: 1 });
      const scale = Math.min(
        2.0,
        1450 / Math.max(natural.width, natural.height),
      );
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("PDF-Rendering nicht unterstützt");
      await page.render({
        canvasContext: context,
        viewport,
        background: "#ffffff",
      }).promise;
      result.push({
        page: pageNo,
        imageData: canvas.toDataURL("image/jpeg", 0.82),
      });
      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;
      onProgress?.(result.length, toPage - fromPage + 1);
    }
    return result;
  } finally {
    await pdf.destroy();
  }
}

/** Load each locally saved exam/lecture and render all pages. Never silently skip. */
export async function renderVisualDocuments(
  documents: StudyDocument[],
  getPdf: (id: string) => Promise<string>,
  onProgress?: (done: number, total: number) => void,
): Promise<DocumentVisuals[]> {
  const total = documents.reduce((n, d) => n + d.pageCount, 0);
  let done = 0;
  const result: DocumentVisuals[] = [];
  for (const doc of documents) {
    const base64 = await getPdf(doc.id);
    const pages = await renderVisualPages(base64, 1, doc.pageCount, (n) =>
      onProgress?.(done + n, total),
    );
    done += pages.length;
    result.push({ documentId: doc.id, pages });
  }
  return result;
}
