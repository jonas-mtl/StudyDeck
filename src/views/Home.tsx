import {
  ArrowUpRight,
  BookOpenCheck,
  FolderPlus,
  Layers2,
  ShieldCheck,
  Link2,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import type { StudyModule } from "../types/domain";
import { shortDate } from "../lib/format";
export function Home({
  modules,
  onNew,
  onGenerate,
  onOpen,
  ankiConnected,
  aiConnected,
  onConnections,
}: {
  modules: StudyModule[];
  onNew: () => void;
  onGenerate: () => void;
  onOpen: (module: StudyModule) => void;
  ankiConnected: boolean;
  aiConnected: boolean;
  onConnections: () => void;
}) {
  return (
    <div className="page fade-in">
      <div className="action-grid">
        <button className="action-tile" onClick={onNew}>
          <div className="tile-top">
            <span className="tile-icon violet">
              <FolderPlus size={27} />
            </span>
            <ArrowUpRight size={22} />
          </div>
          <div>
            <h2>Neues Modul</h2>
            <p>Mit Altklausuren eine individuelle Lernstrategie anlegen.</p>
          </div>
          <span className="tile-foot">
            Modulprofil erstellen <span>→</span>
          </span>
        </button>
        <button className="action-tile" onClick={onGenerate}>
          <div className="tile-top">
            <span className="tile-icon blue">
              <BookOpenCheck size={27} />
            </span>
            <ArrowUpRight size={22} />
          </div>
          <div>
            <h2>Neue Karten</h2>
            <p>
              Folien analysieren, Fragen prüfen und direkt nach Anki übernehmen.
            </p>
          </div>
          <span className="tile-foot">
            Karten generieren <span>→</span>
          </span>
        </button>
      </div>
      <div className="home-connections">
        <button onClick={onConnections} className="home-connection">
          <span
            className={
              ankiConnected ? "connection-dot online" : "connection-dot"
            }
          />
          <Link2 size={17} />
          {ankiConnected ? "Anki verbunden" : "Anki verbinden"}{" "}
          {ankiConnected ? (
            <CheckCircle2 size={15} />
          ) : (
            <ArrowUpRight size={14} />
          )}
        </button>
        <button onClick={onConnections} className="home-connection">
          <span
            className={aiConnected ? "connection-dot online" : "connection-dot"}
          />
          <KeyRound size={17} />
          {aiConnected ? "ChatGPT verbunden" : "Mit ChatGPT anmelden"}{" "}
          {aiConnected ? (
            <CheckCircle2 size={15} />
          ) : (
            <ArrowUpRight size={14} />
          )}
        </button>
      </div>
      {modules.length > 0 && (
        <section className="recent">
          <div className="section-top">
            <h3>Zuletzt angelegte Module</h3>
            <span>
              {modules.length} {modules.length === 1 ? "Modul" : "Module"}
            </span>
          </div>
          <div className="recent-list">
            {modules.slice(0, 4).map((m) => (
              <button
                key={m.id}
                className="recent-row"
                onClick={() => onOpen(m)}
              >
                <span className="recent-icon">
                  <Layers2 size={18} />
                </span>
                <span className="recent-details">
                  <strong>{m.name}</strong>
                  <small>
                    {m.semester} ·{" "}
                    {m.profile ? "Modulprofil erstellt" : "Profil ausstehend"}
                  </small>
                </span>
                <span className="recent-date">{shortDate(m.createdAt)}</span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="small-promise">
        <ShieldCheck size={16} />
        <span>
          Die Original-PDFs bleiben lokal. Für die KI-Auswertung werden
          ausgewählte Seitenbilder an das Modell gesendet. Anki synchronisiert
          deine freigegebenen Karten.
        </span>
      </div>
    </div>
  );
}
