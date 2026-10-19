import { useState } from "react";
import {
  Check,
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  Pencil,
  RefreshCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button, Field, Notice } from "./UI";
import { MathText } from "./MathText";
import { backend, errorMessage } from "../lib/backend";
import { renderPdfPage } from "../lib/pdf";
import type { Card, CardPatch } from "../types/domain";

export function CardEditor({
  card,
  index,
  selected,
  onSelected,
  onChanged,
  onDeleted,
  documentId,
}: {
  card: Card;
  index: number;
  selected: boolean;
  onSelected: (value: boolean) => void;
  onChanged: (c: Card) => void;
  onDeleted: () => void;
  documentId: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [explanation, setExplanation] = useState(card.explanation);
  const [instruction, setInstruction] = useState("");
  const [rewriting, setRewriting] = useState(false);
  const [proposal, setProposal] = useState<Pick<
    Card,
    "front" | "back" | "explanation"
  > | null>(null);
  const [showAi, setShowAi] = useState(false);
  const [working, setWorking] = useState(false);
  const [imagePage, setImagePage] = useState(
    card.imagePage || card.sourcePage || 1,
  );
  const [error, setError] = useState("");
  const readonly = card.status !== "draft";
  async function save() {
    setWorking(true);
    setError("");
    try {
      const p: CardPatch = {
        id: card.id,
        front,
        back,
        explanation,
        sourcePage: card.sourcePage,
        imagePage: card.imagePage,
        tags: card.tags,
      };
      onChanged(await backend.updateCard(p));
      setEditing(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(false);
    }
  }
  async function rewrite() {
    setRewriting(true);
    setError("");
    try {
      setProposal(await backend.rewrite(card.id, instruction));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRewriting(false);
    }
  }
  async function acceptProposal() {
    if (!proposal) return;
    setWorking(true);
    try {
      onChanged(
        await backend.updateCard({
          id: card.id,
          ...proposal,
          sourcePage: card.sourcePage,
          imagePage: card.imagePage,
          tags: card.tags,
        }),
      );
      setFront(proposal.front);
      setBack(proposal.back);
      setExplanation(proposal.explanation);
      setProposal(null);
      setShowAi(false);
      setInstruction("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(false);
    }
  }
  async function attachImage() {
    if (!documentId) return;
    setWorking(true);
    setError("");
    try {
      const pdf = await backend.documentPdf(documentId);
      const image = await renderPdfPage(pdf, imagePage);
      onChanged(await backend.attachImage(card.id, image, imagePage));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(false);
    }
  }
  return (
    <article className={`card-editor ${selected ? "is-selected" : ""}`}>
      <div className="card-toolbar">
        <div className="card-ident">
          <input
            type="checkbox"
            aria-label={`Karte ${index + 1} auswählen`}
            checked={selected}
            disabled={readonly}
            onChange={(e) => onSelected(e.target.checked)}
          />
          <span>Karte {String(index + 1).padStart(2, "0")}</span>
          {(card.sourceName || card.sourcePage !== null) && (
            <span className="source-pill">
              {card.sourceName ?? "Eigene Karte"}
              {card.sourcePage !== null ? ` · Folie ${card.sourcePage}` : ""}
            </span>
          )}
          {readonly && (
            <span className="import-pill">
              <CheckCircle2 size={13} /> In Anki
            </span>
          )}
        </div>
        {!readonly && (
          <div className="icon-actions">
            <button
              title="Karte bearbeiten"
              onClick={() => {
                setEditing(!editing);
                setFront(card.front);
                setBack(card.back);
                setExplanation(card.explanation);
              }}
            >
              <Pencil size={16} />
            </button>
            <button
              title="Mit KI umformulieren"
              onClick={() => {
                setShowAi(!showAi);
                setProposal(null);
              }}
            >
              <Sparkles size={17} />
            </button>
            <button
              className="destructive"
              title="Entwurf löschen"
              onClick={onDeleted}
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="card-edit-form">
          <Field label="Vorderseite">
            <textarea
              rows={3}
              value={front}
              onChange={(e) => setFront(e.target.value)}
            />
          </Field>
          <Field label="Rückseite">
            <textarea
              rows={4}
              value={back}
              onChange={(e) => setBack(e.target.value)}
            />
          </Field>
          <Field label="Erklärung · optional">
            <textarea
              rows={3}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
            />
          </Field>
          <div className="inline-buttons">
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Abbrechen
            </Button>
            <Button
              busy={working}
              disabled={!front.trim() || !back.trim()}
              onClick={() => void save()}
            >
              <Check size={16} /> Speichern
            </Button>
          </div>
        </div>
      ) : (
        <div className="card-content">
          <div className="card-side">
            <span className="card-side-label">VORDERSEITE</span>
            <MathText text={card.front} />
          </div>
          <div className="card-side answer">
            <span className="card-side-label">RÜCKSEITE</span>
            <MathText text={card.back} />
            {card.explanation && (
              <details className="explanation">
                <summary>Zusätzliche Erklärung</summary>
                <MathText text={card.explanation} />
              </details>
            )}
            {card.imageData && (
              <img
                className="card-image"
                src={card.imageData}
                alt={`Abbildung von Folie ${card.imagePage ?? "?"}`}
              />
            )}
          </div>
        </div>
      )}
      {showAi && !readonly && (
        <div className="card-ai">
          <div className="ai-heading">
            <Sparkles size={16} /> Diese Karte umformulieren{" "}
            <button title="Schließen" onClick={() => setShowAi(false)}>
              <X size={16} />
            </button>
          </div>
          <textarea
            rows={2}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="z. B. Frage anspruchsvoller formulieren, Antwort präziser machen …"
          />
          <Button
            variant="secondary"
            disabled={!instruction.trim()}
            busy={rewriting}
            onClick={() => void rewrite()}
          >
            <RefreshCcw size={15} /> Vorschlag erstellen
          </Button>
          {proposal && (
            <div className="rewrite-proposal">
              <span className="eyebrow">
                KI-VORSCHLAG · NOCH NICHT ÜBERNOMMEN
              </span>
              <strong>Frage</strong>
              <MathText text={proposal.front} />
              <strong>Antwort</strong>
              <MathText text={proposal.back} />
              {proposal.explanation && <MathText text={proposal.explanation} />}
              <div className="inline-buttons">
                <Button variant="secondary" onClick={() => setProposal(null)}>
                  Verwerfen
                </Button>
                <Button busy={working} onClick={() => void acceptProposal()}>
                  <Check size={16} /> Übernehmen
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      {!readonly && (
        <details className="image-attach">
          <summary>
            <ImagePlus size={15} /> Folienbild anhängen{" "}
            {card.imageData && "· angehängt"}
          </summary>
          <div className="image-actions">
            <Field label="Folie">
              <input
                type="number"
                min={1}
                value={imagePage}
                onChange={(e) => setImagePage(Number(e.target.value))}
              />
            </Field>
            <Button
              variant="secondary"
              busy={working}
              disabled={!documentId || imagePage < 1}
              onClick={() => void attachImage()}
            >
              {working ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <ImagePlus size={15} />
              )}{" "}
              Folie als Abbildung anhängen
            </Button>
          </div>
          <small>
            Die ganze PDF-Folie wird als Bild übernommen, um Grafiken und
            Schaltungen zu erhalten.
          </small>
        </details>
      )}
      {error && (
        <Notice tone="error" onClose={() => setError("")}>
          {error}
        </Notice>
      )}
    </article>
  );
}
