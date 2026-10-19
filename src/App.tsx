import { useCallback, useEffect, useState } from "react";
import {
  BookMarked,
  CheckCircle2,
  HelpCircle,
  Layers3,
  Link2,
  Monitor,
  RefreshCcw,
  Settings2,
  Sparkles,
  WifiOff,
  X,
  KeyRound,
} from "lucide-react";
import { Button, Notice } from "./components/UI";
import { AiConnection } from "./components/AiConnection";
import { Home } from "./views/Home";
import UpdateChecker from "./components/UpdateChecker";
import { NewModule } from "./views/NewModule";
import { ModuleProfile } from "./views/ModuleProfile";
import { Generate, type ReviewContext } from "./views/Generate";
import { Review } from "./views/Review";
import { backend, errorMessage } from "./lib/backend";
import type { ConnectionStatus, StudyModule } from "./types/domain";
import "./styles/main.css";

type Screen = "home" | "create" | "profile" | "generate" | "review";
export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [modules, setModules] = useState<StudyModule[]>([]);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [settings, setSettings] = useState(false);
  const [error, setError] = useState("");
  const [reviewContext, setReviewContext] = useState<ReviewContext | null>(
    null,
  );
  const selected = modules.find((m) => m.id === moduleId) || null;
  const refresh = useCallback(async () => {
    try {
      const [ms, connection] = await Promise.all([
        backend.modules(),
        backend.status(),
      ]);
      setModules(ms);
      setStatus(connection);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function openModule(m: StudyModule) {
    setModuleId(m.id);
    setScreen("profile");
  }
  async function created(m: StudyModule) {
    setModules((prev) => [m, ...prev.filter((x) => x.id !== m.id)]);
    setModuleId(m.id);
    setScreen("profile");
  }
  function updated(m: StudyModule) {
    setModules((prev) => prev.map((x) => (x.id === m.id ? m : x)));
  }
  function deleted(id: string) {
    setModules((prev) => prev.filter((m) => m.id !== id));
    setModuleId(null);
    setScreen("home");
  }
  function beginGenerate() {
    setScreen("generate");
  }
  function showReview(id: string, ctx: ReviewContext) {
    setModuleId(id);
    setReviewContext(ctx);
    setScreen("review");
  }
  return (
    <>
      <UpdateChecker />
      <div className="app-shell">
        <header className="app-header">
          <button
            className="brand"
            onClick={() => setScreen("home")}
            title="Zur Übersicht"
          >
            <span className="brand-logo">
              <BookMarked size={21} strokeWidth={2.2} />
            </span>
            <span style={{ letterSpacing: 2.5, margin: 6 }}>
              Wilkommen<span className="brand-period"></span>
            </span>
          </button>
          <div className="header-end">
            <button
              className={`connection-chip ${status?.ankiConnected ? "is-online" : ""}`}
              onClick={() => setSettings(true)}
              title="Anki-Verbindung verwalten"
            >
              {status?.ankiConnected ? (
                <CheckCircle2 size={16} />
              ) : (
                <Link2 size={16} />
              )}
              <span>
                {status?.ankiConnected ? "Anki verbunden" : "Anki verbinden"}
              </span>
            </button>
            <button
              className={`connection-chip ${status?.aiConnected ? "is-online" : ""}`}
              onClick={() => setSettings(true)}
              title="ChatGPT-Verbindung verwalten"
            >
              <KeyRound size={16} />
              <span>
                {status?.aiConnected ? "ChatGPT verbunden" : "ChatGPT anmelden"}
              </span>
            </button>
            <button
              className="header-icon"
              onClick={() => setSettings(true)}
              aria-label="Einstellungen"
            >
              <Settings2 size={19} />
            </button>
          </div>
        </header>
        <main className="app-main">
          {error && (
            <Notice tone="error" onClose={() => setError("")}>
              {error}
            </Notice>
          )}
          {screen === "home" && (
            <Home
              aiConnected={status?.aiConnected ?? false}
              ankiConnected={status?.ankiConnected ?? false}
              onConnections={() => setSettings(true)}
              modules={modules}
              onNew={() => setScreen("create")}
              onGenerate={beginGenerate}
              onOpen={(m) => void openModule(m)}
            />
          )}
          {screen === "create" && (
            <NewModule
              onBack={() => setScreen("home")}
              onCreated={(m) => void created(m)}
            />
          )}
          {screen === "profile" && selected && (
            <ModuleProfile
              module={selected}
              onBack={() => setScreen("home")}
              onGenerate={beginGenerate}
              onUpdated={updated}
              onDeleted={deleted}
            />
          )}
          {screen === "generate" && (
            <Generate
              modules={modules}
              initialModule={moduleId}
              onBack={() => setScreen("home")}
              onModuleChange={setModuleId}
              onDone={(id, ctx) => showReview(id, ctx)}
            />
          )}
          {screen === "review" && selected && (
            <Review
              key={`${moduleId}-${reviewContext?.documentId}`}
              module={selected}
              context={reviewContext}
              onBack={beginGenerate}
            />
          )}
        </main>
        <footer className="app-footer">
          <span>
            StudyDeck{" "}
            <span className="footer-muted">v0.2 · PDF-Vision & Pi OAuth</span>
          </span>
          <span className="footer-right">
            <Sparkles size={13} /> Verständnis, das bleibt.
          </span>
        </footer>
        {settings && (
          <div
            className="modal-overlay"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setSettings(false);
            }}
            role="presentation"
          >
            <div
              className="settings-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Verbindungen"
            >
              <div className="modal-header">
                <div>
                  <span className="eyebrow">VERBINDUNGEN</span>
                  <h2>Alles an einem Ort.</h2>
                </div>
                <button
                  className="close-modal"
                  onClick={() => setSettings(false)}
                  aria-label="Schließen"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="connection-section">
                <div className="connection-heading">
                  <span className="settings-icon anki-icon">
                    <Layers3 size={22} />
                  </span>
                  <div>
                    <strong>Anki Desktop</strong>
                    <small>{status?.ankiMessage || "Wird überprüft …"}</small>
                  </div>
                  <span
                    className={`status-light ${status?.ankiConnected ? "on" : ""}`}
                  />
                </div>
                <p>
                  Installiere das AnkiConnect-Add-on in Anki Desktop und lasse
                  Anki beim Import geöffnet.
                </p>
                <div className="command-line">
                  <code>Anki → Extras → Erweiterungen → 2055492159</code>
                </div>
                <small>
                  Nach der Installation Anki neu starten. Keine Zugangsdaten
                  erforderlich.
                </small>
              </div>
              <div className="connection-section">
                <div className="connection-heading">
                  <span className="settings-icon codex-icon">
                    <Sparkles size={22} />
                  </span>
                  <div>
                    <strong>ChatGPT-Konto</strong>
                    <small>
                      Über Pi OAuth · Integrierter Login · Vision-Analyse
                    </small>
                  </div>
                  <span
                    className={`status-light ${status?.aiConnected ? "on" : ""}`}
                  />
                </div>
                <AiConnection
                  connected={status?.aiConnected ?? false}
                  onChanged={refresh}
                />
              </div>
              <div className="settings-footer">
                <div>
                  <Monitor size={15} /> macOS · Windows · Linux
                </div>
                <Button
                  variant="secondary"
                  onClick={() =>
                    void backend
                      .status()
                      .then(setStatus)
                      .catch((e) => setError(errorMessage(e)))
                  }
                >
                  <RefreshCcw size={16} /> Verbindungen prüfen
                </Button>
              </div>
              <div className="legal-foot">
                <WifiOff size={14} /> Die Anmeldung nutzt Pi OAuth. Zugangsdaten
                werden lokal gespeichert und nicht im Frontend verarbeitet.{" "}
                <HelpCircle size={14} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
