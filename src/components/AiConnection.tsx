import { useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { Button, Notice, Field } from "./UI";
import { backend, errorMessage } from "../lib/backend";
import type { AiLoginState } from "../types/domain";

/** OAuth stays in the native Node bridge. This component never handles tokens. */
export function AiConnection({
  connected,
  onChanged,
}: {
  connected: boolean;
  onChanged: () => Promise<void>;
}) {
  const [state, setState] = useState<AiLoginState | null>(null);
  const reported = useRef(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const next = await backend.aiLoginState();
        if (alive) {
          setState(next);
          if (next.phase === "connected" && !reported.current) {
            reported.current = true;
            await onChanged();
          }
          if (next.phase !== "connected") {
            reported.current = false;
          }
        }
      } catch (e) {
        if (alive) setError(errorMessage(e));
      }
    };
    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 1100);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [onChanged]);
  async function start() {
    setWorking(true);
    setError("");
    try {
      await backend.beginAiLogin();
      setState(await backend.aiLoginState());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(false);
    }
  }
  async function openBrowser() {
    if (!state?.url) return;
    try {
      const url = new URL(state.url);
      if (
        url.protocol !== "https:" ||
        !["auth.openai.com", "chatgpt.com", "login.openai.com"].includes(
          url.hostname,
        )
      )
        throw new Error("Unerwartete Anmeldedomain. Browser nicht geöffnet.");
      await openUrl(url.toString());
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function sendCode() {
    setWorking(true);
    try {
      await backend.submitAiCode(code);
      setCode("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(false);
    }
  }
  async function logout() {
    setWorking(true);
    try {
      reported.current = false;
      await backend.logoutAi();
      setState(await backend.aiLoginState());
      await onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="oauth-ui">
      {connected ? (
        <div className="oauth-status ok">
          <CheckCircle2 size={17} /> Verbunden über ChatGPT (Pi OAuth)
        </div>
      ) : (
        <div className="oauth-status">
          <KeyRound size={17} /> Noch kein ChatGPT-Konto verbunden
        </div>
      )}
      <p>
        StudyDeck verwendet Pi für die Anmeldung. Dein Passwort wird
        ausschließlich auf der offiziellen OpenAI-Seite eingegeben, niemals in
        StudyDeck.
      </p>
      {!connected && (
        <div className="oauth-actions">
          <Button busy={working} onClick={() => void start()}>
            <KeyRound size={16} /> Mit ChatGPT anmelden
          </Button>
          {state?.url && ["browser", "waiting"].includes(state.phase) && (
            <Button variant="secondary" onClick={() => void openBrowser()}>
              <ExternalLink size={15} /> Im Browser fortfahren
            </Button>
          )}
        </div>
      )}
      {state &&
        ["opening", "browser", "waiting", "code"].includes(state.phase) && (
          <div className="oauth-progress">
            <LoaderCircle className="spin" size={15} /> {state.message}
          </div>
        )}
      {state?.phase === "code" && (
        <div className="oauth-code">
          <Field label="Autorisierungscode oder Redirect-URL">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Hier einfügen"
            />
          </Field>
          <Button
            disabled={!code.trim()}
            busy={working}
            onClick={() => void sendCode()}
          >
            Bestätigen
          </Button>
        </div>
      )}
      {state?.phase === "error" && (
        <Notice tone="error">{state.message}</Notice>
      )}
      {connected && (
        <Button
          variant="secondary"
          onClick={() => void logout()}
          busy={working}
        >
          <LogOut size={15} /> Abmelden
        </Button>
      )}
      {error && (
        <Notice tone="error" onClose={() => setError("")}>
          {error}
        </Notice>
      )}
      <small>
        <RefreshCw size={13} /> Keine zusätzliche OpenAI-API-Abrechnung. Es
        gelten die Nutzungsgrenzen deines ChatGPT-Tarifs.
      </small>
    </div>
  );
}
