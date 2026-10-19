import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  Moon,
  Cpu,
} from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { Button, Notice } from "./components/UI";
import { AiConnection } from "./components/AiConnection";
import { PromptSettings } from "./components/PromptSettings";
import { AiExecutionSettings } from "./components/AiExecutionSettings";
import { AppearanceSettings } from "./components/AppearanceSettings";
import { useTheme } from "./lib/useTheme";
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
  const [settingsTab, setSettingsTab] = useState<
    "connections" | "prompts" | "ai" | "appearance"
  >("connections");
  const { theme, setTheme } = useTheme();
  const [error, setError] = useState("");
  const [appVersion, setAppVersion] = useState("");
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
  useEffect(() => {
    getVersion().then(setAppVersion).catch(console.error);
  }, []);
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
  // Escape closes the topmost dialog first, then navigates like the visible Back button.
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented || event.repeat)
        return;
      if (settings) {
        event.preventDefault();
        setSettings(false);
        return;
      }
      // Child dialogs and inline card editors handle their own Escape key first.
      if (
        document.querySelector(
          "[data-studydeck-modal='true'], [data-card-active='true'], [data-review-add-open='true']",
        )
      )
        return;
      if (screen !== "home") {
        event.preventDefault();
        if (screen === "review") setScreen("generate");
        else setScreen("home");
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [settings, screen]);

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
              Willkommen<span className="brand-period"></span>
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
            <span className="footer-muted">
              v{appVersion} · PDF-Vision & Pi OAuth
            </span>
          </span>
          <span className="footer-right">
            <Sparkles size={13} /> Verständnis, das bleibt.
          </span>
        </footer>
        {settings &&
          createPortal(
            <div
              className="modal-overlay"
              data-studydeck-settings="true"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setSettings(false);
              }}
              role="presentation"
            >
              <div
                className={`settings-modal ${settingsTab === "prompts" || settingsTab === "ai" ? "settings-modal-wide" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-label="Einstellungen"
              >
                <div className="modal-header">
                  <div>
                    <span className="eyebrow">STUDYDECK</span>
                    <h2>Einstellungen</h2>
                  </div>
                  <button
                    className="close-modal"
                    onClick={() => setSettings(false)}
                    aria-label="Schließen"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div
                  className="settings-tabs"
                  role="tablist"
                  aria-label="Einstellungsbereich"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={settingsTab === "connections"}
                    className={settingsTab === "connections" ? "active" : ""}
                    onClick={() => setSettingsTab("connections")}
                  >
                    Verbindungen
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={settingsTab === "prompts"}
                    className={settingsTab === "prompts" ? "active" : ""}
                    onClick={() => setSettingsTab("prompts")}
                  >
                    KI-Prompts
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={settingsTab === "ai"}
                    className={settingsTab === "ai" ? "active" : ""}
                    onClick={() => setSettingsTab("ai")}
                  >
                    <Cpu size={14} /> Modell & Seiten
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={settingsTab === "appearance"}
                    className={settingsTab === "appearance" ? "active" : ""}
                    onClick={() => setSettingsTab("appearance")}
                  >
                    <Moon size={14} /> Darstellung
                  </button>
                </div>
                {settingsTab === "connections" && (
                  <>
                    <div className="connection-section">
                      <div className="connection-heading">
                        <span className="settings-icon anki-icon">
                          <Layers3 size={22} />
                        </span>
                        <div>
                          <strong>Anki Desktop</strong>
                          <small>
                            {status?.ankiMessage || "Wird überprüft …"}
                          </small>
                        </div>
                        <span
                          className={`status-light ${status?.ankiConnected ? "on" : ""}`}
                        />
                      </div>
                      <p>
                        Installiere das AnkiConnect-Add-on in Anki Desktop und
                        lasse Anki beim Import geöffnet.
                      </p>
                      <div className="command-line">
                        <code>Anki → Extras → Erweiterungen → 2055492159</code>
                      </div>
                      <small>
                        Nach der Installation Anki neu starten. Keine
                        Zugangsdaten erforderlich.
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
                      <WifiOff size={14} /> Die Anmeldung nutzt Pi OAuth.
                      Zugangsdaten werden lokal gespeichert und nicht im
                      Frontend verarbeitet. <HelpCircle size={14} />
                    </div>
                  </>
                )}
                <div hidden={settingsTab !== "prompts"}>
                  <PromptSettings />
                </div>
                {settingsTab === "ai" && <AiExecutionSettings />}
                {settingsTab === "appearance" && (
                  <AppearanceSettings theme={theme} onChange={setTheme} />
                )}
              </div>
            </div>,
            document.body,
          )}
      </div>
    </>
  );
}
