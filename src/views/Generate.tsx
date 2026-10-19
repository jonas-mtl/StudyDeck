import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  FileCheck2,
  FileText,
  Info,
  Layers3,
  Sparkles,
} from "lucide-react";
import { Back, Button, Field, Notice } from "../components/UI";
import { PdfInput, type PdfSelection } from "../components/PdfInput";
import { backend, errorMessage } from "../lib/backend";
import { renderPdfPage } from "../lib/pdf";
import { renderVisualPages } from "../lib/visualPdf";
import type { Card, StudyDocument, StudyModule } from "../types/domain";
export interface ReviewContext {
  documentId: string;
  fromPage: number;
  toPage: number;
}
export function Generate({
  modules,
  initialModule,
  onBack,
  onDone,
  onModuleChange,
}: {
  modules: StudyModule[];
  initialModule: string | null;
  onBack: () => void;
  onDone: (moduleId: string, ctx: ReviewContext, cards: Card[]) => void;
  onModuleChange: (id: string) => void;
}) {
  const [moduleId, setModuleId] = useState(
    initialModule || modules[0]?.id || "",
  );
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(1);
  const [hints, setHints] = useState("");
  const [renderProgress, setRenderProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [selection, setSelection] = useState<PdfSelection[]>([]);
  useEffect(() => {
    if (!moduleId) return;
    setDocumentId("");
    void backend
      .documents(moduleId)
      .then((ds) => {
        const slides = ds.filter((d) => d.kind === "lecture");
        setDocuments(slides);
        if (slides[0]) {
          setDocumentId(slides[0].id);
          setToPage(slides[0].pageCount);
        }
      })
      .catch((e) => setError(errorMessage(e)));
  }, [moduleId]);
  const selected = documents.find((d) => d.id === documentId);
  const chosen = modules.find((m) => m.id === moduleId);
  useEffect(() => {
    if (!selection[0] || !moduleId) return;
    let canceled = false;
    setUploading(true);
    setError("");
    const file = selection[0];
    void backend
      .saveDocument(moduleId, file.name, "lecture", file.pages, file.base64)
      .then((d) => {
        if (!canceled) {
          setDocuments((old) => [d, ...old]);
          setDocumentId(d.id);
          setFromPage(1);
          setToPage(d.pageCount);
          setSelection([]);
        }
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setUploading(false));
    return () => {
      canceled = true;
    };
  }, [selection, moduleId]);
  async function generate() {
    if (!selected || !moduleId) return;
    setLoading(true);
    setError("");
    try {
      setRenderProgress(0);
      const pdf = await backend.documentPdf(selected.id);
      const visuals = await renderVisualPages(
        pdf,
        fromPage,
        toPage,
        (n, total) => setRenderProgress(Math.round((100 * n) / total)),
      );
      const cards = await backend.generate(
        moduleId,
        selected.id,
        fromPage,
        toPage,
        hints,
        visuals,
      );
      // If the model marked a relevant visual, attach that slide as a PNG automatically.
      const suggestions = cards.filter((c) => c.imagePage !== null);
      if (suggestions.length) {
        try {
          const rendered = new Map<number, string>();
          for (const card of suggestions) {
            const page = card.imagePage!;
            if (!rendered.has(page))
              rendered.set(page, await renderPdfPage(pdf, page));
            await backend.attachImage(card.id, rendered.get(page)!, page);
          }
        } catch (e) {
          console.warn(
            "Ein vorgeschlagenes Folienbild konnte nicht automatisch angehängt werden:",
            e,
          );
        }
      }
      onDone(moduleId, { documentId: selected.id, fromPage, toPage }, cards);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="page form-page fade-in">
      <Back onClick={onBack} />
      <div className="page-heading">
        <span className="eyebrow">SCHRITT 02 / KARTEN</span>
        <h1>Aus Folien wird Verständnis.</h1>
        <p>
          Wähle den Vorlesungsabschnitt. Die KI prüft zuerst, welche Aspekte
          bereits in Anki abgedeckt sind.
        </p>
      </div>
      <div className="panel form-panel">
        <Field label="Modul">
          <div className="select-wrap">
            <select
              value={moduleId}
              onChange={(e) => {
                setModuleId(e.target.value);
                onModuleChange(e.target.value);
              }}
            >
              {modules.length === 0 ? (
                <option value="">Bitte zuerst ein Modul erstellen</option>
              ) : (
                modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.semester} · {m.name}
                  </option>
                ))
              )}
            </select>
            <ChevronDown size={16} />
          </div>
        </Field>
        {chosen && (
          <div className="module-inline">
            <span>
              <Layers3 size={16} />
              {chosen.profile
                ? "Modulprofil verfügbar"
                : "Noch kein Modulprofil"}
            </span>
            <small>Konzeptuelle Karteikarten · ohne Formel-Drills</small>
          </div>
        )}
        <div className="form-divider" />
        <Field label="Neue Vorlesungsfolien">
          <PdfInput label="Vorlesungs-PDF hochladen" onSelect={setSelection} />
        </Field>
        {documents.length > 0 && (
          <Field label="Oder eine bereits hochgeladene Vorlesung wählen">
            <select
              value={documentId}
              onChange={(e) => {
                const d = documents.find((x) => x.id === e.target.value);
                setDocumentId(e.target.value);
                setFromPage(1);
                setToPage(d?.pageCount || 1);
              }}
            >
              {documents.map((d) => (
                <option value={d.id} key={d.id}>
                  {d.name} · {d.pageCount} Seiten
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="form-row two">
          <Field label="Von Folie">
            <input
              type="number"
              min={1}
              max={selected?.pageCount || 9999}
              value={fromPage}
              onChange={(e) => setFromPage(Number(e.target.value))}
            />
          </Field>
          <Field label="Bis Folie">
            <input
              type="number"
              min={1}
              max={selected?.pageCount || 9999}
              value={toPage}
              onChange={(e) => setToPage(Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Hinweise · optional">
          <textarea
            rows={3}
            value={hints}
            onChange={(e) => setHints(e.target.value)}
            placeholder="z. B. Besonders wichtig: Unterschied zwischen Kausalität und Stabilität. Keine numerischen Faltungsaufgaben."
          />
        </Field>
        <div className="hint-row">
          <Info size={16} />
          <span>
            Alle ausgewählten PDF-Seiten werden visuell analysiert, auch bei
            Scans und Grafiken. Die KI berücksichtigt das Modulprofil und den
            bisherigen Anki-Stapel.
          </span>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="form-actions">
          <Button
            busy={loading || uploading}
            disabled={
              !selected ||
              !moduleId ||
              fromPage < 1 ||
              toPage < fromPage ||
              toPage > (selected?.pageCount ?? 0)
            }
            onClick={() => void generate()}
          >
            <Sparkles size={17} />
            {loading
              ? renderProgress < 100
                ? `Folien werden visuell erfasst · ${renderProgress}%`
                : "KI analysiert Folienbilder …"
              : uploading
                ? "PDF wird gespeichert …"
                : "Fragen generieren"}
            <ArrowRight size={17} />
          </Button>
        </div>
      </div>
      <div className="info-grid">
        <div>
          <span>
            <FileText size={20} />
          </span>
          <strong>Folien verstehen</strong>
          <p>Wichtige Zusammenhänge statt Folie-für-Folie-Kopieren.</p>
        </div>
        <div>
          <span>
            <BookOpen size={20} />
          </span>
          <strong>Prüfung im Blick</strong>
          <p>Altklausuren beeinflussen, welche Konzepte priorisiert werden.</p>
        </div>
        <div>
          <span>
            <FileCheck2 size={20} />
          </span>
          <strong>Vor dem Import prüfen</strong>
          <p>Du kannst jede Karte anpassen, entfernen oder ergänzen.</p>
        </div>
      </div>
    </div>
  );
}
