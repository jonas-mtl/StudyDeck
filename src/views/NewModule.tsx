import { useState } from "react";
import {
  GraduationCap,
  ChevronRight,
  FileText,
  Target,
  BrainCircuit,
} from "lucide-react";
import { Back, Button, Field, Notice } from "../components/UI";
import { PdfInput, type PdfSelection } from "../components/PdfInput";
import { backend, errorMessage } from "../lib/backend";
import { renderVisualDocuments } from "../lib/visualPdf";
import { getSemesterOptions } from "../lib/format";
import type { StudyModule } from "../types/domain";
export function NewModule({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (module: StudyModule) => void;
}) {
  const [semester, setSemester] = useState("3. Semester");
  const [name, setName] = useState("");
  const [visualStatus, setVisualStatus] = useState("");
  const [files, setFiles] = useState<PdfSelection[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingModule, setPendingModule] = useState<StudyModule | null>(null);
  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    let created: StudyModule | null = null;
    try {
      created = await backend.createModule(name, semester);
      for (const pdf of files)
        await backend.saveDocument(
          created.id,
          pdf.name,
          "exam",
          pdf.pages,
          pdf.base64,
        );
      const exams = (await backend.documents(created.id)).filter(
        (d) => d.kind === "exam",
      );
      const visuals = await renderVisualDocuments(
        exams,
        backend.documentPdf,
        (n, total) =>
          setVisualStatus(
            `${n} / ${total} Altklausur-Seiten visuell vorbereitet`,
          ),
      );
      created = await backend.generateProfile(created.id, visuals);
      onCreated(created);
    } catch (e) {
      setError(
        errorMessage(e) +
          (created
            ? " Das Modul ist bereits angelegt; das Profil kannst du später erneut erstellen."
            : ""),
      );
      if (created) setPendingModule(created);
    } finally {
      setBusy(false);
      setVisualStatus("");
    }
  }
  return (
    <div className="page form-page fade-in">
      <Back onClick={onBack} />
      <div className="page-heading">
        <span className="eyebrow">SCHRITT 01 / MODUL</span>
        <h1>Ein neues Modul anlegen.</h1>
        <p>
          Ein eigenes Prüfungsprofil hilft StudyDeck, die richtigen Fragen zu
          stellen.
        </p>
      </div>
      <div className="panel form-panel">
        <div className="form-row two">
          <Field label="Semester">
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            >
              {getSemesterOptions().map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Modulname">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Halbleiterbauelemente"
              maxLength={130}
              autoFocus
            />
          </Field>
        </div>
        <div className="form-divider" />
        <Field
          label="Altklausuren · optional"
          hint="Mehrere PDFs sind möglich. Sie dienen der Priorisierung, nicht als alleinige Wissensquelle."
        >
          <PdfInput
            multiple
            label="Altklausuren auswählen"
            onSelect={setFiles}
          />
        </Field>
        {files.length > 0 && (
          <div className="file-summary">
            <FileText size={16} />
            {files.length} {files.length === 1 ? "Datei" : "Dateien"} ·{" "}
            {files.reduce((s, f) => s + f.pages.length, 0)} Seiten erfasst
          </div>
        )}
        {busy && visualStatus && (
          <div className="file-summary">{visualStatus}</div>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {pendingModule && (
          <Button variant="secondary" onClick={() => onCreated(pendingModule)}>
            Bereits angelegtes Modul öffnen <ChevronRight size={17} />
          </Button>
        )}
        <div className="form-actions">
          <Button
            onClick={() => void submit()}
            disabled={!name.trim() || !!pendingModule}
            busy={busy}
          >
            {busy
              ? "Altklausuren werden visuell analysiert …"
              : "Modul erstellen"}
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>
      <div className="info-grid">
        <div>
          <span>
            <Target size={19} />
          </span>
          <strong>Klausurfokus</strong>
          <p>Die KI sucht die Konzepte hinter typischen Prüfungsaufgaben.</p>
        </div>
        <div>
          <span>
            <BrainCircuit size={19} />
          </span>
          <strong>Konzeptuelles Lernen</strong>
          <p>
            Keine reinen Formelabfragen oder auswendig zu lernenden Rechenwege.
          </p>
        </div>
        <div>
          <span>
            <GraduationCap size={19} />
          </span>
          <strong>Wachsendes Profil</strong>
          <p>Später gefundene Altklausuren kannst du ergänzen.</p>
        </div>
      </div>
    </div>
  );
}
