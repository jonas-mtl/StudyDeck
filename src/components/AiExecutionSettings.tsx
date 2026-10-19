import { useEffect, useState } from "react";
import { Cpu, RefreshCw, Save, SlidersHorizontal } from "lucide-react";
import { backend, errorMessage } from "../lib/backend";
import type { AiModel, AiSettings } from "../types/domain";
import { Button, Notice } from "./UI";

const MIN_PAGES = 1;
const MAX_PAGES = 60;

/** Central settings shared by card generation, exam profiles and coverage audits. */
export function AiExecutionSettings() {
  const [saved, setSaved] = useState<AiSettings | null>(null);
  const [pages, setPages] = useState(30);
  const [modelId, setModelId] = useState("");
  const [models, setModels] = useState<AiModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modelError, setModelError] = useState("");
  const [success, setSuccess] = useState("");

  async function refreshModels() {
    setLoadingModels(true);
    setModelError("");
    try {
      const available = await backend.aiModels();
      setModels(available);
      if (available.length === 0)
        setModelError(
          "Die installierte Pi-Bibliothek meldet keine bildfähigen Codex-Modelle.",
        );
    } catch (err) {
      setModelError(errorMessage(err));
    } finally {
      setLoadingModels(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    backend
      .aiSettings()
      .then((value) => {
        if (!mounted) return;
        setSaved(value);
        setPages(value.maxPagesPerRequest);
        setModelId(value.modelId || "");
      })
      .catch((err) => {
        if (mounted) setError(errorMessage(err));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    void refreshModels();
    return () => {
      mounted = false;
    };
  }, []);

  const valid =
    Number.isInteger(pages) && pages >= MIN_PAGES && pages <= MAX_PAGES;
  const dirty =
    saved !== null &&
    (saved.maxPagesPerRequest !== pages || (saved.modelId || "") !== modelId);
  // Keep a previously configured model selectable, even when a different Pi version is installed.
  const missingModel = modelId !== "" && !models.some((m) => m.id === modelId);

  async function save() {
    if (!valid || !dirty || saving) return;
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const value = await backend.saveAiSettings(pages, modelId || null);
      setSaved(value);
      setSuccess(
        "Gespeichert. Die nächste KI-Anfrage verwendet diese Einstellungen.",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="prompt-loading">KI-Einstellungen werden geladen …</div>
    );

  return (
    <div className="ai-execution-settings">
      <div className="settings-section-heading">
        <SlidersHorizontal size={21} />
        <div>
          <h3>KI-Ausführung</h3>
          <p>
            Diese Optionen gelten global für Kartengenerierung, Modulprofile und
            Abdeckungsprüfung.
          </p>
        </div>
      </div>
      {error && (
        <Notice tone="error" onClose={() => setError("")}>
          {error}
        </Notice>
      )}
      {success && (
        <Notice tone="success" onClose={() => setSuccess("")}>
          {success}
        </Notice>
      )}
      <div className="settings-control-card">
        <label htmlFor="ai-pages">PDF-Seiten pro KI-Auftrag</label>
        <p>
          Weniger Seiten bedeuten kleinere Anfragen, aber mehr einzelne Aufrufe.
          Mehr Seiten sparen Aufrufe, können jedoch Modelllimits oder das
          JSON-Ausgabelimit erreichen.
        </p>
        <div className="pages-setting-row">
          <input
            id="ai-pages-range"
            type="range"
            min={MIN_PAGES}
            max={MAX_PAGES}
            value={valid ? pages : 30}
            onChange={(event) => setPages(Number(event.target.value))}
            aria-label="PDF-Seiten pro KI-Auftrag"
          />
          <input
            id="ai-pages"
            type="number"
            min={MIN_PAGES}
            max={MAX_PAGES}
            step={1}
            value={pages}
            onChange={(event) => setPages(Number(event.target.value))}
          />
          <span>Seiten</span>
        </div>
        {!valid && (
          <small className="setting-validation">
            Bitte eine ganze Zahl zwischen {MIN_PAGES} und {MAX_PAGES} eingeben.
          </small>
        )}
        <small>
          Standard: 30 Seiten. Der ausgewählte Bereich wird in mehrere Anfragen
          aufgeteilt. Die PDF-Seiten werden weiterhin visuell analysiert.
        </small>
      </div>
      <div className="settings-control-card">
        <div className="setting-title-row">
          <label htmlFor="ai-model">
            <Cpu size={16} /> KI-Modell
          </label>
          <button
            className="settings-link"
            type="button"
            disabled={loadingModels}
            onClick={() => void refreshModels()}
          >
            <RefreshCw size={14} />{" "}
            {loadingModels ? "Lade …" : "Liste aktualisieren"}
          </button>
        </div>
        <p>
          Die Modelle stammen aus der auf deinem Gerät installierten
          Pi-Bibliothek und unterstützen Bildeingaben.
        </p>
        <select
          id="ai-model"
          value={modelId}
          onChange={(event) => setModelId(event.target.value)}
        >
          <option value="">Automatisch auswählen (empfohlen)</option>
          {missingModel && (
            <option value={modelId}>
              {modelId} (aktuell nicht in der Liste)
            </option>
          )}
          {models.map((model) => (
            <option value={model.id} key={model.id}>
              {model.name !== model.id
                ? `${model.name} (${model.id})`
                : model.id}
            </option>
          ))}
        </select>
        {modelError && (
          <small className="setting-validation">{modelError}</small>
        )}
        {missingModel && (
          <small className="setting-validation">
            Dieses Modell wird von der aktuellen Pi-Version nicht gemeldet.
            Wähle ein anderes Modell oder „Automatisch“.
          </small>
        )}
        <small>
          Die Modellliste zeigt technisch verfügbare Einträge, keine garantierte
          Freischaltung für dein Konto. Bei fehlender Berechtigung liefert die
          KI eine Fehlermeldung.
        </small>
      </div>
      <div className="settings-save-row">
        <span>
          {dirty ? "Nicht gespeicherte Änderungen" : "Einstellungen aktuell"}
        </span>
        <Button
          disabled={
            !valid ||
            !dirty ||
            saving ||
            (missingModel && modelId !== saved?.modelId)
          }
          busy={saving}
          onClick={() => void save()}
        >
          <Save size={16} /> Einstellungen speichern
        </Button>
      </div>
    </div>
  );
}
