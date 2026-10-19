# StudyDeck 0.2 — klausurorientiertes konzeptionelles Lernen mit Anki

Desktop-App für **macOS / Windows / Linux**, erstellt mit **Tauri 2,
React/TypeScript und Rust**. Minimalistisches, macOS-inspiriertes UI.

## Was die App macht

1. **ChatGPT und Anki im Startbereich verbinden.** Bei der ChatGPT-Anmeldung
   öffnet StudyDeck den offiziellen OAuth-Login im Browser. Kein API-Key.
2. **Neues Modul:** Semester, Modulname, optional Altklausur-PDFs.
   Die KI liest die Seiten **visuell**, einschließlich Diagrammen, Formeln,
   Abbildungen und eingescannten Aufgaben. Es entsteht ein Modulprofil mit
   begründeten Schwerpunkten.
3. **Neue Karten:** Modul, PDF, Seitenbereich und optionale Hinweise.
   StudyDeck rendert die Folien als Bilder, übergibt sie an ein visionfähiges
   Modell und berücksichtigt Modulprofil und vorhandene Anki-Fragen.
4. **Kartenvorschau:** Alle Karten bearbeiten, umformulieren lassen,
   löschen, Bilder anfügen, manuell oder per KI ergänzen.
5. **Freigabe:** Erst danach werden die ausgewählten Karten über AnkiConnect
   in den Modulstapel importiert. Die Anki-eigene Synchronisierung übernimmt
   den Abgleich mit Telefon oder Tablet.

**Lernregel:** Verständnis, Annahmen, Interpretationen, Methodenwahl,
Gegenbeispiele und Transfer — **keine isolierten Formeln, Rechenaufgaben oder
Auswendiglern-Rechenwege**. Die Übungen bleiben dafür zuständig.

## Entwicklungsstart

Voraussetzungen: Node.js **22+**, Rust, Tauri-2-Buildvoraussetzungen,
Anki Desktop und AnkiConnect (Add-on `2055492159`).

```bash
npm install
npm run tauri dev
```

Dadurch wird automatisch die Node-Pi-Bridge gebündelt und Tauri geöffnet.
**Eine CLI-Anmeldung ist nicht mehr erforderlich.** In der App auf
„ChatGPT anmelden“ klicken, dann „Im Browser fortfahren“.

### Release

```bash
npm run tauri build
```

Für installierbare Versionen ohne Node-Voraussetzung ist der Workflow
`.github/workflows/build.yml` vorbereitet. Dieser kopiert den jeweiligen
Node-Prozess in das installierbare Tauri-Bundle und erzeugt getrennte Builds.
Die Art der Integration muss vor einer Freigabe auf den Zielsystemen geprüft
werden. Weder ein getesteter Installer noch ein erfolgreicher OAuth-Live-Test
liegt hier bereits vor.

## Kosten, Grenzen und Datenschutz

Der integrierte Pi-Zugang nutzt OAuth für `openai-codex` (ChatGPT-
Subscription); die App verwendet **keine OpenAI-API-Schlüssel** und besitzt
keinen kostenpflichtigen Token-Fallback. Nutzungslimits und mögliche
Berechtigungsänderungen der Anbindung bleiben bestehen. Die Integration ist
für persönliche Verwendung gedacht; für andere Nutzungsmodelle gelten die
Anbieterbedingungen.

**Wichtig:** PDF-Originaldateien bleiben in den lokalen Appdaten. Zur Analyse
werden die betroffenen PDF-Seiten **als Bilder** und ergänzende Textauszüge
an das gewählte KI-Modell übertragen. Die KI läuft nicht vollständig lokal.

## Projektstruktur

```text
studydeck/
├─ ai/
│  ├─ bridge.mjs                 Pi OAuth, Modellauswahl, Multimodal-Request
│  └─ runtime/                  Node-Laufzeit in Release-Paketen
├─ src/
│  ├─ components/               PDF-Upload, KI-Anmeldung, Karteneditor, MathJax
│  ├─ lib/                      Native Adapter, PDF.js, visuelle Seitenrenderung
│  ├─ views/                    Startseite, Module, Profile, Generieren, Freigabe
│  ├─ types/                    Gemeinsame TypeScript-Datenmodelle
│  └─ styles/                   UI-Styling
├─ src-tauri/
│  └─ src/
│     ├─ commands/              UI-Befehle
│     ├─ services/              Pi und AnkiConnect
│     ├─ db.rs                  SQLite mit lokalen PDFs und Karten
│     └─ models.rs              Rust-Modelle
├─ tests/                       Tests
├─ docs/                        Architektur und Pi-OAuth/PDF-Vision
└─ .github/workflows/build.yml  Plattformübergreifende Preview-Builds
```

Technische Details: [Pi OAuth & PDF Vision](docs/PI_OAUTH_AND_VISION.md).

## Noch zu prüfen

- `npm install`, TypeScript- und Rust-Build (in dieser Umgebung sind Paket-
  registries und die Rust-Toolchain nicht erreichbar).
- Reale OAuth-Anmeldung und Vision-Auswertung mit eigenem ChatGPT-Konto.
- Testimport mit echten AnkiConnect-Stapeln.
- Bündelung der Node-Laufzeit in allen drei Installervarianten.

Dieses Repository ist eine **Preview-Implementierung**, nicht als fertig
validiertes Endnutzerprodukt auszugeben.


### Module löschen, Anki-Stapel und Quellen
- **Modul löschen:** Im Modulprofil „Modul löschen“ auswählen und bestätigen. Entfernt nur lokale StudyDeck-Daten sowie lokal gespeicherte PDFs. Importierte Anki-Karten und Anki-Stapel werden nicht angefasst.
- **Anki-Ziel:** Ein eigener Stapel pro Modul unter `Semester::Modulname` (Anki-Hierarchie). Falls Karten früher in einem falschen Stapel gelandet sind, bleiben sie dort und müssen in Anki verschoben werden.
- **Quellangabe:** Für generierte Karten wird der ursprüngliche PDF-Dateiname mit der Foliennummer angezeigt und beim Anki-Import auf der Rückseite als Quelle vermerkt. Bereits importierte Karten ändern sich nicht rückwirkend. Manuelle Karten ohne Vorlesungsbezug haben keine PDF-Quelle.
