/** PDF.js text extraction (supplemental). Actual AI processing happens via visualPdf.ts and Pi image inputs. */
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PageText } from "../types/domain";
GlobalWorkerOptions.workerSrc = pdfWorker;

export async function readPdf(
  file: File,
): Promise<{ pages: PageText[]; base64: string }> {
  if (!file.name.toLowerCase().endsWith(".pdf"))
    throw new Error("Bitte eine PDF-Datei auswählen.");
  if (file.size > 60 * 1024 * 1024)
    throw new Error("PDF größer als 60 MB. Bitte komprimieren.");
  const source = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data: source.slice() }).promise;
  const pages: PageText[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pieces: string[] = [];
    for (const item of content.items) {
      if ("str" in item) pieces.push(item.str);
    }
    pages.push({ page: i, text: pieces.join(" ").replace(/\s+/g, " ").trim() });
    page.cleanup();
  }
  await pdf.destroy();
  // Avoid stack overflow when converting large Uint8Arrays to base64.
  const chunks: string[] = [];
  for (let offset = 0; offset < source.length; offset += 8192) {
    const bytes = source.subarray(offset, offset + 8192);
    let part = "";
    for (const b of bytes) part += String.fromCharCode(b);
    chunks.push(part);
  }
  return { pages, base64: btoa(chunks.join("")) };
}

export async function renderPdfPage(
  base64: string,
  pageNumber: number,
): Promise<string> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const pdf = await getDocument({ data: bytes }).promise;
  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    await pdf.destroy();
    throw new Error("Foliennummer nicht vorhanden");
  }
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.3 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");
  await page.render({ canvasContext: ctx, viewport }).promise;
  // JPEG is smaller, but Anki's media implementation currently expects PNG.
  const png = canvas.toDataURL("image/png");
  await pdf.destroy();
  return png;
}
