import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CircleHelp,
  RotateCcw,
  Save,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { backend, errorMessage } from "../lib/backend";
import type { PromptEntry } from "../types/domain";
import { Button, Notice } from "./UI";

export function PromptSettings() {
  const [prompts, setPrompts] = useState<PromptEntry[]>([]);
  const [active, setActive] = useState("cards_task");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    backend
      .prompts()
      .then((data) => {
        if (!cancelled) setPrompts(data);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = prompts.find((p) => p.id === active) ?? prompts[0];
  const currentText = selected ? (drafts[selected.id] ?? selected.value) : "";
  const changed = !!selected && currentText !== selected.value;
  const pendingCount = useMemo(
    () =>
      prompts.filter(
        (p) => drafts[p.id] !== undefined && drafts[p.id] !== p.value,
      ).length,
    [drafts, prompts],
  );
  const groups = useMemo(
    () => [...new Set(prompts.map((p) => p.group))],
    [prompts],
  );

  function replacePrompt(updated: PromptEntry) {
    setPrompts((old) => old.map((p) => (p.id === updated.id ? updated : p)));
    setDrafts((old) => {
      const next = { ...old };
      delete next[updated.id];
      return next;
    });
  }

  async function save() {
    if (!selected || !changed || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const updated = await backend.savePrompt(selected.id, currentText);
      replacePrompt(updated);
      setSuccess(
        `„${updated.title}“ wurde gespeichert. Neue KI-Anfragen verwenden diese Version.`,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const updated = await backend.resetPrompt(selected.id);
      replacePrompt(updated);
      setSuccess(
        `„${updated.title}“ wurde auf den Original-Prompt zurückgesetzt.`,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="prompt-settings">
      <div className="prompt-intro">
        <div>
          <span className="eyebrow">INDIVIDUELLE KI-ANWEISUNGEN</span>
          <p>
            Bearbeite die Vorgaben für die KI. Änderungen gelten global für neue
            Anfragen und werden nur auf diesem Gerät gespeichert.
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="prompt-draft-count">
            {pendingCount} ungespeichert
          </span>
        )}
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
      {loading ? (
        <div className="prompt-loading">Lade Prompts …</div>
      ) : (
        <div className="prompt-layout">
          <nav className="prompt-nav" aria-label="KI-Prompt auswählen">
            {groups.map((group) => (
              <div className="prompt-nav-group" key={group}>
                <span className="prompt-group-title">{group}</span>
                {prompts
                  .filter((p) => p.group === group)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`prompt-nav-item ${p.id === selected?.id ? "active" : ""}`}
                      onClick={() => {
                        setActive(p.id);
                        setError("");
                        setSuccess("");
                      }}
                    >
                      <span>{p.title}</span>
                      {drafts[p.id] !== undefined &&
                      drafts[p.id] !== p.value ? (
                        <span
                          className="prompt-dot unsaved"
                          title="Noch nicht gespeichert"
                        />
                      ) : p.customized ? (
                        <span
                          className="prompt-dot customized"
                          title="Angepasst"
                        />
                      ) : null}
                    </button>
                  ))}
              </div>
            ))}
          </nav>
          {selected && (
            <section className="prompt-content">
              <div className="prompt-content-heading">
                <div>
                  <h3>
                    <ScrollText size={19} /> {selected.title}
                  </h3>
                  <p>{selected.description}</p>
                </div>
                <span
                  className={`prompt-status ${selected.customized ? "custom" : ""}`}
                >
                  {selected.customized ? (
                    <>
                      <Sparkles size={13} /> Angepasst
                    </>
                  ) : (
                    <>
                      <Check size={13} /> Standard
                    </>
                  )}
                </span>
              </div>
              {selected.kind === "template" && (
                <div className="prompt-placeholder-help">
                  <CircleHelp size={16} />
                  <div>
                    <strong>Platzhalter für dynamische Inhalte</strong>
                    <p>
                      Diese Felder werden bei jeder KI-Anfrage automatisch
                      ausgefüllt. Notwendige Platzhalter müssen erhalten
                      bleiben.
                    </p>
                    <div className="prompt-tokens">
                      {selected.placeholders.map((token) => (
                        <button
                          type="button"
                          key={token}
                          title="Platzhalter am Textende einfügen"
                          onClick={() =>
                            setDrafts((old) => ({
                              ...old,
                              [selected.id]:
                                (old[selected.id] ?? selected.value) +
                                `\n{{${token}}}`,
                            }))
                          }
                        >
                          {`{{${token}}}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {selected.kind === "json" && (
                <div className="prompt-schema-warning">
                  <CircleHelp size={16} />
                  JSON-Schemas definieren das technische Antwortformat.
                  Pflichtfelder dürfen nicht entfernt werden, sonst können
                  Karten und Analysen nicht verarbeitet werden.
                </div>
              )}
              <textarea
                className="prompt-textarea"
                aria-label={`${selected.title} bearbeiten`}
                value={currentText}
                onChange={(e) => {
                  setDrafts((old) => ({
                    ...old,
                    [selected.id]: e.target.value,
                  }));
                  setSuccess("");
                }}
                spellCheck={false}
              />
              <div className="prompt-content-footer">
                <span>
                  {currentText.length.toLocaleString("de-DE")} Zeichen
                  {changed ? " · Nicht gespeichert" : ""}
                </span>
                <div className="prompt-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy || (!selected.customized && !changed)}
                    onClick={() => void reset()}
                  >
                    <RotateCcw size={15} /> Standard wiederherstellen
                  </Button>
                  <Button
                    type="button"
                    busy={busy}
                    disabled={!changed}
                    onClick={() => void save()}
                  >
                    <Save size={15} /> Änderungen speichern
                  </Button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
      <p className="prompt-info-foot">
        Bestehende Karten bleiben unverändert. Für neue KI-Anfragen werden die
        zuletzt gespeicherten Texte verwendet.
      </p>
    </div>
  );
}
