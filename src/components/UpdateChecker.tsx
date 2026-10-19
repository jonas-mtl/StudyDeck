import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export default function UpdateChecker() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkForUpdates() {
      try {
        // Nur in installierten Release-Builds prüfen,
        // nicht bei npm run tauri:dev.
        if (import.meta.env.DEV) return;

        const available = await check();

        if (cancelled) return;

        if (available) {
          setUpdate(available);
        }
      } catch (err) {
        console.error("Updateprüfung fehlgeschlagen:", err);
      }
    }

    void checkForUpdates();

    return () => {
      cancelled = true;
    };
  }, []);

  async function installUpdate() {
    if (!update || installing) return;

    setInstalling(true);
    setError("");

    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (err) {
      setError(String(err));
      setInstalling(false);
    }
  }

  useEffect(() => {
    if (!update) return;
    function escapeUpdate(event: KeyboardEvent) {
      if (
        event.key !== "Escape" ||
        document.querySelector(
          "[data-studydeck-settings='true'], [data-studydeck-delete='true']",
        )
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!installing) setUpdate(null);
    }
    document.addEventListener("keydown", escapeUpdate, true);
    return () => document.removeEventListener("keydown", escapeUpdate, true);
  }, [update, installing]);

  if (!update) return null;

  return createPortal(
    <div className="modal-overlay" data-studydeck-modal="true">
      <div className="delete-dialog">
        <h2>Update verfügbar</h2>

        <p>
          StudyDeck <strong>v{update.version}</strong> ist verfügbar.
        </p>

        <p className="muted">
          Möchtest du die neue Version herunterladen und installieren?
        </p>

        {error && <p className="error-text">{error}</p>}

        <div className="inline-buttons">
          <button
            className="button button-secondary"
            disabled={installing}
            onClick={() => setUpdate(null)}
          >
            Später
          </button>

          <button
            className="button button-primary"
            disabled={installing}
            onClick={() => void installUpdate()}
          >
            {installing ? "Installiere …" : "Jetzt aktualisieren"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
