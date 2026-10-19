import { useEffect, useState } from "react";
import {
  ChevronRight,
  FilePlus2,
  Layers,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Back, Button, Empty, Field, Notice } from "../components/UI";
import { PdfInput, type PdfSelection } from "../components/PdfInput";
import { backend, errorMessage } from "../lib/backend";
import { renderVisualDocuments } from "../lib/visualPdf";
import { createPortal } from "react-dom";
import { deckName } from "../lib/format";
import type { StudyModule, StudyDocument, Coverage } from "../types/domain";
export function ModuleProfile({
  module,
  onBack,
  onGenerate,
  onUpdated,
  onDeleted,
}: {
  module: StudyModule;
  onBack: () => void;
  onGenerate: () => void;
  onUpdated: (m: StudyModule) => void;
  onDeleted: (id: string) => void;
}) {
  const [visualStatus, setVisualStatus] = useState("");
  const [audit, setAudit] = useState<Coverage | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [docs, setDocs] = useState<StudyDocument[]>([]);
  const [files, setFiles] = useState<PdfSelection[]>([]);
  const [busy, setBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    void backend
      .documents(module.id)
      .then(setDocs)
      .catch((e) => setError(errorMessage(e)));
  }, [module.id]);
  async function update() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      for (const pdf of files)
        await backend.saveDocument(
          module.id,
          pdf.name,
          "exam",
          pdf.pages,
          pdf.base64,
        );
      const exams = (await backend.documents(module.id)).filter(
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
      const m = await backend.generateProfile(module.id, visuals);
      onUpdated(m);
      setDocs(await backend.documents(module.id));
      setFiles([]);
      setSuccess("Das Modulprofil wurde aktualisiert.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      setVisualStatus("");
    }
  }
  async function auditNow() {
    setAuditing(true);
    setError("");
    try {
      const lectures = (await backend.documents(module.id)).filter(
        (d) => d.kind === "lecture",
      );
      const visuals = await renderVisualDocuments(
        lectures,
        backend.documentPdf,
        (n, total) =>
          setVisualStatus(
            `${n} / ${total} Vorlesungsseiten visuell vorbereitet`,
          ),
      );
      setAudit(await backend.audit(module.id, visuals));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setAuditing(false);
      setVisualStatus("");
    }
  }
  async function removeModule() {
    if (busy || auditing) return;

    setBusy(true);
    setError("");

    try {
      await backend.deleteModule(module.id);
      setShowDeleteConfirm(false);
      onDeleted(module.id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!showDeleteConfirm) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (
        event.key !== "Escape" ||
        document.querySelector("[data-studydeck-settings='true']")
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!busy) setShowDeleteConfirm(false);
    }
    document.addEventListener("keydown", closeOnEscape, true);
    return () => document.removeEventListener("keydown", closeOnEscape, true);
  }, [showDeleteConfirm, busy]);

  const profile = module.profile;
  return (
    <div className="page fade-in">
      <Back onClick={onBack} />
      <div className="page-heading profile-heading">
        <span className="eyebrow">
          {module.semester.toUpperCase()} · MODULPROFIL
        </span>
        <h1>{module.name}</h1>
        <p>Dein Klausurfokus für die gesamte Vorlesung.</p>
      </div>
      {!profile ? (
        <Empty
          icon={<Layers size={32} />}
          title="Profil noch nicht erstellt"
          detail="Du kannst bereits manuelle Karten erstellen. Für die KI-Analyse bitte ChatGPT verbinden und das Profil generieren."
        />
      ) : (
        <div className="profile-grid">
          <div className="panel profile-main">
            <span className="eyebrow">PRÜFUNGSSTRATEGIE</span>
            <h2>{profile.summary}</h2>
            <div className="profile-section">
              <h3>Klausurrelevante Verständnisschwerpunkte</h3>
              {profile.examFocus.length ? (
                profile.examFocus.map((v, i) => (
                  <p key={i} className="profile-bullet">
                    <span>0{i + 1}</span>
                    {v}
                  </p>
                ))
              ) : (
                <p className="muted">Keine belastbare Zuordnung verfügbar.</p>
              )}
            </div>
            <div className="profile-section">
              <h3>Kernkonzepte</h3>
              <div className="pills">
                {profile.coreConcepts.map((v, i) => (
                  <span key={i} className="pill">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="right-column">
            <div className="panel compact-panel">
              <span className="eyebrow">FRAGESTIL</span>
              {profile.questionStyle.map((v, i) => (
                <p key={i} className="bullet-small">
                  ✓ {v}
                </p>
              ))}
            </div>
            <div className="panel compact-panel">
              <span className="eyebrow">WAS NICHT ABGEFRAGT WIRD</span>
              {profile.excluded.map((v, i) => (
                <p key={i} className="bullet-small">
                  – {v}
                </p>
              ))}
            </div>
            <div className="panel compact-panel">
              <span className="eyebrow">BELEGE AUS ALTKLAUSUREN</span>
              {profile.evidence.length ? (
                profile.evidence.map((v, i) => (
                  <p key={i} className="bullet-small">
                    {v}
                  </p>
                ))
              ) : (
                <p className="muted">
                  Keine Altklausuren hinterlegt. Klausurprioritäten sind
                  vorläufig.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="panel supplemental">
        <div className="section-top">
          <h3>Altklausuren ergänzen</h3>
          <span>{docs.filter((d) => d.kind === "exam").length} hinterlegt</span>
        </div>
        <p className="muted">
          Das Profil kann jederzeit neu bewertet werden. Vorhandene Karten
          bleiben erhalten.
        </p>
        <Field label="Neue Altklausuren">
          <PdfInput
            multiple
            label="Weitere PDFs auswählen"
            onSelect={setFiles}
          />
        </Field>
        <div className="form-actions">
          <Button variant="secondary" busy={busy} onClick={() => void update()}>
            <RefreshCw size={16} />{" "}
            {files.length
              ? "Dateien hinzufügen & Profil aktualisieren"
              : "Modulprofil aktualisieren"}
          </Button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {success && <Notice tone="success">{success}</Notice>}
      </div>
      <div className="panel supplemental">
        <div className="section-top">
          <h3>Konzeptionelle Abdeckungsprüfung</h3>
          <span>Für den Semesterabschluss</span>
        </div>
        <p className="muted">
          Vergleicht bisherige Folien (inklusive Grafiken) mit deinen
          Anki-Fragen und lokalen Entwürfen. Die Einschätzung kann unvollständig
          sein.
        </p>
        <Button
          variant="secondary"
          busy={auditing}
          onClick={() => void auditNow()}
        >
          <Sparkles size={16} />{" "}
          {auditing
            ? "Verständnis-Lücken werden geprüft …"
            : "Abdeckung prüfen"}
        </Button>
        {audit && (
          <div className="coverage-results">
            <p>{audit.overview}</p>
            <div className="coverage-columns">
              <div>
                <strong>Gut abgedeckt</strong>
                {audit.covered.map((x, i) => (
                  <p key={i}>✓ {x}</p>
                ))}
              </div>
              <div>
                <strong>Offene Konzepte</strong>
                {audit.missing.map((x, i) => (
                  <p key={i}>→ {x}</p>
                ))}
              </div>
              <div>
                <strong>Unsicher</strong>
                {audit.uncertain.map((x, i) => (
                  <p key={i}>? {x}</p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      {visualStatus && <div className="file-summary">{visualStatus}</div>}
      <div className="profile-footer">
        <div>
          <span className="eyebrow">ANKI-ZIELSTAPEL</span>
          <p>{deckName(module.semester, module.name)}</p>
        </div>
        <div className="profile-actions">
          <Button
            className="module-delete"
            style={{ margin: "0px 2rem" }}
            variant="danger"
            disabled={busy || auditing}
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 size={16} />
            Modul löschen
          </Button>
          <Button onClick={onGenerate}>
            Neue Karten erstellen <ChevronRight size={17} />
          </Button>
        </div>
      </div>
      <div className="caption">
        <Sparkles size={14} /> Prüfungsprognosen sind Schätzungen auf Grundlage
        der vorhandenen Unterlagen, keine Klausurgarantie.{" "}
        <FilePlus2 size={14} />
      </div>
      {showDeleteConfirm &&
        createPortal(
          <div
            className="modal-overlay"
            data-studydeck-modal="true"
            data-studydeck-delete="true"
            role="presentation"
          >
            <div
              className="delete-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Modul löschen"
            >
              <h2>Modul löschen?</h2>

              <p>
                Möchtest du das Modul <strong>{module.name}</strong> wirklich
                löschen?
              </p>

              <p className="muted">
                Alle lokalen Dokumente, Modulprofile und Kartenentwürfe werden
                entfernt. Bereits importierte Anki-Karten bleiben erhalten.
              </p>

              <div className="inline-buttons">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Abbrechen
                </Button>

                <Button
                  variant="danger"
                  busy={busy}
                  onClick={() => void removeModule()}
                >
                  Endgültig löschen
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
