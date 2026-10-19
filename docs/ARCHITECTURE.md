# StudyDeck: Architektur

**Version:** 0.2 · Tauri 2, Rust, React/TypeScript, lokale SQLite-Datenbank.

## Datenfluss

```text
Desktop-UI
  ├── Start / Verbindung: AnkiConnect + Pi OAuth
  ├── Neues Modul ──┬── Altklausur-PDF speichern (lokal)
  │                 └── PDF.js rendert jede Seite → Rust → Pi Vision → Modulprofil
  └── Neue Karten ─┬── Modul auswählen, Folien/Seiten/Hinweise
                   ├── Folien-Seiten als JPEG rendern (auch ohne PDF-Text)
                   ├── AnkiConnect: vorhandene Fragen lesen
                   ├── Pi Vision: Bildseiten in 6er-Gruppen + Profil/Kontext
                   ├── Vorschau: Vorder-/Rückseite + Bilder + AI-Rewrite
                   └── Freigabe → AnkiConnect → Anki Sync
```

## Warum Bildseiten?

Bei mathematischen und technischen Vorlesungen kann reiner PDF-Text die
wichtigen Informationen in Diagrammen, Schaltungen, Achsen und Formellayout
nicht darstellen. Alle ausgewählten Seitenbilder sind daher **zwingend**.
Fehlende Seitenbilder führen zu einem expliziten Fehler statt eines Text-
Fallbacks. PDF-Text dient als zusätzliches Signal für das Modell.

## Lokaler Speicher

Im Tauri-App-Datenverzeichnis:

- `studydeck.sqlite`: Module, Profile, Folien-Text, Karten, Batches.
- `pdfs/`: Originaldateien.
- `pi-oauth.json`: durch Pi ausgestelltes OAuth-Credential (nie in React).
- `pi-login-state.json`: öffentlicher lokaler Login-Fortschritt (ohne Token).
- `pi_jobs/`: temporäre Eingabe-Ausgabe-JSONs, nach Ausführung entfernt.

Originaldateien bleiben lokal. Die Bilder der zur Verarbeitung ausgewählten
Seiten werden an den KI-Anbieter übertragen. Die Anki-Daten sind ebenfalls
lokal; Synchronisierung läuft ausschließlich über Anki.

## Komponenten

- `src/views/`: UI-Seiten.
- `src/components/AiConnection.tsx`: Anmeldeprozess und Status.
- `src/lib/visualPdf.ts`: rasterisierte PDF-Seiten (JPEG).
- `src-tauri/src/services/pi.rs`: Prozessverwaltung, temporäre Dateiübertragung,
  Login-Status, Seitenvalidierung, feste Timeouts.
- `ai/bridge.mjs`: Pi-Bibliothek, OAuth und `complete()` mit nativen Image-Blöcken.
- `src-tauri/src/services/prompts.rs`: fachübergreifende, klausurorientierte
  Fragenpolitik, JSON-Schemata und Vorwissen.
- `src-tauri/src/services/anki.rs`: AnkiConnect und benutzerdefinierter Notiztyp.
- `src-tauri/src/commands/modules.rs`: visuelle Altklausuren und Modulabdeckung.
- `src-tauri/src/commands/cards.rs`: Kartenworkflow, Review, Import.

## Ausschluss von Formel-/Rechendrills

Der Prompt priorisiert Ursachen, Rahmenbedingungen, Systemverständnis,
Modellauswahl, Interpretationen und Transfer. Altklausuren dienen zur
Priorisierung, auch wenn diese überwiegend aus Rechenaufgaben bestehen.

## Fehler und Sicherheit

- Kein Zugriff auf Browser-Cookies.
- Kein Zugang mit API-Key, keine kostenpflichtige Backup-Route.
- Keine stillschweigende textbasierte Auswertung bei fehlenden Bildern.
- Kein ungefragter Import in Anki.
- Ein Node-Prozess läuft lokal; bei KI-Anfragen verlässt nur das Material
  der ausgewählten Seiten (plus Kontext) die Anwendung.

## Bekannte Lücken

- Noch kein getesteter nativer Tauri-Installer und kein OAuth-Live-Test.
- Fehlende CI-E2E-Tests ohne Login.
- Überlappende Themen werden primär per KI-Kontext und normalisierten Fragen
  dedupliziert; semantische Einzigartigkeit kann nicht garantiert werden.
- Kein Bearbeitungsalgorithmus für den punktgenauen Zuschnitt von Bildern;
  ggf. wird eine ganze Folie als Abbildung gespeichert.
