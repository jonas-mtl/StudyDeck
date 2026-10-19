import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCheck,
  FilePlus2,
  Filter,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Back, Button, Empty, Field, Notice } from "../components/UI";
import { CardEditor } from "../components/CardEditor";
import { backend, errorMessage } from "../lib/backend";
import { renderVisualPages } from "../lib/visualPdf";
import type { Card, StudyModule } from "../types/domain";
import type { ReviewContext } from "./Generate";

export function Review({
  module,
  context,
  onBack,
}: {
  module: StudyModule;
  context: ReviewContext | null;
  onBack: () => void;
}) {
  const [cards, setCards] = useState<Card[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [importing, setImporting] = useState(false);
  const [addMode, setAddMode] = useState<"none" | "manual" | "ai">("none");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [explanation, setExplanation] = useState("");
  const [instruction, setInstruction] = useState("");
  const [working, setWorking] = useState(false);
  const [filter, setFilter] = useState<"draft" | "all">("draft");
  useEffect(() => {
    setLoading(true);
    void backend
      .cards(module.id)
      .then((items) => {
        setCards(items);
        setSelected(items.filter((c) => c.status === "draft").map((c) => c.id));
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [module.id]);
  const drafts = useMemo(
    () => cards.filter((c) => c.status === "draft"),
    [cards],
  );
  const visible = filter === "draft" ? drafts : cards;
  function changeCard(card: Card) {
    setCards((old) => old.map((c) => (c.id === card.id ? card : c)));
  }
  async function deleteCard(id: string) {
    setError("");
    try {
      await backend.deleteCard(id);
      setCards((old) => old.filter((c) => c.id !== id));
      setSelected((old) => old.filter((x) => x !== id));
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function addManual() {
    setWorking(true);
    setError("");
    try {
      const card = await backend.addManual(module.id, front, back, explanation);
      setCards((prev) => [...prev, card]);
      setSelected((prev) => [...prev, card.id]);
      setFront("");
      setBack("");
      setExplanation("");
      setAddMode("none");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(false);
    }
  }
  async function addAi() {
    if (!context) {
      setError(
        "Bitte zuerst eine Vorlesung im Bereich „Neue Karten“ auswählen.",
      );
      return;
    }
    setWorking(true);
    setError("");
    try {
      const pdf = await backend.documentPdf(context.documentId);
      const visuals = await renderVisualPages(
        pdf,
        context.fromPage,
        context.toPage,
      );
      const added = await backend.extra(
        module.id,
        context.documentId,
        context.fromPage,
        context.toPage,
        instruction,
        visuals,
      );
      setCards((old) => [...old, ...added]);
      setSelected((old) => [...old, ...added.map((c) => c.id)]);
      setInstruction("");
      setSuccess(`${added.length} zusätzliche Karten vorgeschlagen.`);
      setAddMode("none");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(false);
    }
  }
  async function importCards() {
    if (!selected.length) return;
    setImporting(true);
    setError("");
    setSuccess("");
    try {
      const result = await backend.importCards(module.id, selected);
      const latest = await backend.cards(module.id);
      setCards(latest);
      setSelected((old) => old.filter((id) => !result.imported.includes(id)));
      if (result.imported.length)
        setSuccess(
          `${result.imported.length} Karten erfolgreich in Anki gespeichert. Synchronisiere Anki anschließend wie gewohnt.`,
        );
      if (result.errors.length)
        setError(
          `${result.errors.length} Karten nicht importiert:\n${result.errors.join("\n")}`,
        );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setImporting(false);
    }
  }
  return (
    <div className="page review-page fade-in">
      <Back onClick={onBack} />
      <div className="review-heading">
        <div>
          <span className="eyebrow">
            SCHRITT 03 / FREIGABE · {module.name.toUpperCase()}
          </span>
          <h1>Deine Karten. Deine Kontrolle.</h1>
          <p>
            Vorder- und Rückseite prüfen, umformulieren oder ergänzen – erst
            danach nach Anki.
          </p>
        </div>
        <div className="count-highlight">
          <strong>{drafts.length}</strong>
          <span>Entwürfe</span>
        </div>
      </div>
      <div className="review-toolbar">
        <div className="toolbar-left">
          <button
            className="seg active"
            onClick={() => setFilter("draft")}
            aria-pressed={filter === "draft"}
          >
            Entwürfe <span>{drafts.length}</span>
          </button>
          <button
            className={`seg ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
            aria-pressed={filter === "all"}
          >
            Alle <span>{cards.length}</span>
          </button>
        </div>
        <button
          className="subtle-action"
          onClick={() =>
            setSelected(
              selected.length === drafts.length ? [] : drafts.map((c) => c.id),
            )
          }
        >
          <CheckCheck size={16} />
          {selected.length === drafts.length
            ? "Auswahl aufheben"
            : "Alle auswählen"}
        </button>
      </div>
      {loading ? (
        <div className="spinner-block">
          <RefreshCw className="spin" /> Karten werden geladen …
        </div>
      ) : visible.length === 0 ? (
        <Empty
          icon={<BookOpenCheck size={36} />}
          title="Noch keine Karten"
          detail="Erstelle mit den Vorlesungsfolien neue Karten oder füge eine Karte manuell hinzu."
        />
      ) : (
        <div className="cards-stack">
          {visible.map((c, i) => (
            <CardEditor
              key={c.id}
              card={c}
              index={i}
              selected={selected.includes(c.id)}
              onSelected={(yes) =>
                setSelected((old) =>
                  yes
                    ? [...new Set([...old, c.id])]
                    : old.filter((x) => x !== c.id),
                )
              }
              onChanged={changeCard}
              onDeleted={() => void deleteCard(c.id)}
              documentId={context?.documentId || null}
            />
          ))}
        </div>
      )}
      <div className="add-panel">
        <div className="add-actions">
          <button
            onClick={() => setAddMode(addMode === "manual" ? "none" : "manual")}
            className={addMode === "manual" ? "chosen" : ""}
          >
            <Plus size={17} /> Karte manuell hinzufügen
          </button>
          <button
            onClick={() => setAddMode(addMode === "ai" ? "none" : "ai")}
            className={addMode === "ai" ? "chosen" : ""}
          >
            <Sparkles size={17} /> KI um weitere Karte bitten
          </button>
        </div>
        {addMode === "manual" && (
          <div className="add-form">
            <Field label="Vorderseite">
              <textarea
                rows={3}
                value={front}
                onChange={(e) => setFront(e.target.value)}
                placeholder="Welche Verständnisfrage soll gestellt werden?"
              />
            </Field>
            <Field label="Rückseite">
              <textarea
                rows={3}
                value={back}
                onChange={(e) => setBack(e.target.value)}
                placeholder="Knapp und nachvollziehbar beantworten …"
              />
            </Field>
            <Field label="Zusätzliche Erklärung · optional">
              <textarea
                rows={2}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
              />
            </Field>
            <Button
              disabled={!front.trim() || !back.trim()}
              busy={working}
              onClick={() => void addManual()}
            >
              <Plus size={16} /> Karte hinzufügen
            </Button>
          </div>
        )}
        {addMode === "ai" && (
          <div className="add-form">
            <Field label="Was soll zusätzlich verstanden werden?">
              <textarea
                rows={3}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Generiere eine zusätzliche Karte, die das Verständnis der Zeitinvarianz von LTI-Systemen stärker abfragt."
              />
            </Field>
            <p className="muted">
              Die KI berücksichtigt den vorhandenen Anki-Stapel und alle
              bisherigen Entwürfe.
            </p>
            <Button
              busy={working}
              disabled={!instruction.trim() || !context}
              onClick={() => void addAi()}
            >
              <Sparkles size={16} /> Weitere Karte vorschlagen
            </Button>
            {!context && (
              <small className="muted">
                Zuerst eine Vorlesung auswählen, damit die neue Karte auf Folien
                beruht.
              </small>
            )}
          </div>
        )}
      </div>
      {error && (
        <Notice tone="error" onClose={() => setError("")}>
          <span className="preserve-lines">{error}</span>
        </Notice>
      )}
      {success && (
        <Notice tone="success" onClose={() => setSuccess("")}>
          {success}
        </Notice>
      )}
      <div className="review-footer">
        <div>
          <strong>{selected.length} Entwürfe ausgewählt</strong>
          <span>Importiert wird nur, was du freigibst.</span>
        </div>
        <Button
          busy={importing}
          disabled={selected.length === 0}
          onClick={() => void importCards()}
        >
          <FilePlus2 size={17} />
          {importing ? "Anki-Import läuft …" : "Ausgewählte Karten nach Anki"}
          <ArrowRight size={17} />
        </Button>
      </div>
      <div className="bottom-note">
        <Filter size={14} /> Neue Karten bleiben als Entwurf lokal gespeichert.
        Importierte Karten behalten ihren Lernfortschritt in Anki.
      </div>
    </div>
  );
}
