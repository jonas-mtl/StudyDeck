# Pi OAuth und visuelle PDF-Verarbeitung (Version 0.2)

## Was sich geändert hat

Der frühere Codex-CLI-Textpfad wurde entfernt. StudyDeck verwendet
`@mariozechner/pi-ai` in einer separaten lokalen Node-Bridge für **OAuth** und
**nativen Bild-Input** (`type: "image"`) eines visionfähigen `openai-codex`-Modells.
Es gibt **keine API-Key-Eingabe** und **keinen API-Fallback**. Ein eigenes ChatGPT-
Konto ist erforderlich. Kontingente der jeweiligen ChatGPT/Codex-Nutzung gelten.

## Anmeldung direkt in der App

1. In der Startseite „Mit ChatGPT anmelden“ wählen, Einstellungen öffnen.
2. „Mit ChatGPT anmelden“ starten.
3. „Im Browser fortfahren“ öffnen. OAuth findet auf `auth.openai.com` statt.
4. Nach Weiterleitung an `localhost` erkennt die Bridge die Anmeldung. Wenn der
   lokale Callback blockiert ist, fragt die App nach dem Rückleitungs-Code.
5. StudyDeck speichert das von Pi zurückgegebene OAuth-Credential getrennt von
   anderen Tools in `pi-oauth.json` im App-Datenverzeichnis (Dateimodus 0600, wo
   vom Betriebssystem unterstützt). Das Passwort wird niemals in StudyDeck eingegeben.

**Hinweis:** Diese Variante benutzt die persönliche Pi/Codex-Subscription-
Integration, nicht die Anmeldung „Sign in with ChatGPT“ für registrierte
Partner-Apps. Die Nutzbarkeit ist von den verfügbaren Modellen, Berechtigungen
und Servicebedingungen abhängig. Getestet werden muss mit einem echten Konto.

## PDF-Vision

`src/lib/visualPdf.ts` rendert jede ausgewählte PDF-Seite über PDF.js in ein
JPEG (max. 1450 Pixel Kantenlänge, Qualität 0.82). Die gesamte Sequenz wird
an den Rust-Backendbefehl übergeben, der den Auftrag in Blöcken zu je sechs
Seiten an die Pi-Bridge delegiert. Der Node-Prozess sendet **echte multimodale
Bildblöcke**, keine OCR-Pseudo-Analyse. Ergänzender PDF-Text ist nur ein
zusätzlicher Hinweis.

Die Modulprofile aus Altklausuren und die Semesterabdeckung verwenden dieselbe
Bildpipeline. Fehlt eine Seite, stoppt der Backendaufruf mit einem Fehler. Eine
stille textbasierte Ersatzanalyse ist nicht implementiert.

PDFs und Karteikarten verbleiben lokal. Bei KI-Aufträgen werden **Bilder aller
betroffenen PDF-Seiten zusammen mit ergänzendem Text** an den von Pi
adressierten KI-Anbieter gesendet. Keine Aussage über vollständig lokale
KI-Verarbeitung treffen.

Die Vision erkennt keine Inhalte mit absoluter Sicherheit. Für schlecht
lesbare Scans und winzige Beschriftungen müssen höhere Auflösungen bzw.
Originalquellen verwendet werden. Die Kartenfreigabe bleibt notwendig.

## Architektur

- `ai/bridge.mjs` — Pi OAuth + nativer Bild-Input, JSON-Ausgabe.
- `src-tauri/src/services/pi.rs` — Start des lokalen Prozesses, Auftragsdaten,
  Seitenvalidierung, Zeitlimits, Status.
- `src-tauri/src/commands/system.rs` — in der UI nutzbare Anmelde-/Abmeldebefehle.
- `src/lib/visualPdf.ts` — seitenweise Visualisierung im Frontend.
- `src-tauri/src/commands/modules.rs` — visuelle Altklausuren und Coverage.
- `src-tauri/src/commands/cards.rs` — visuelle Folien und Duplikatkontrolle.
- `src/components/AiConnection.tsx` — Anmelde-UI.

## Builds für macOS, Windows und Linux

`npm install` und danach `npm run tauri dev`. Für den Release-Build bündelt
GitHub Actions den Node-22-Laufzeitprozess der jeweiligen Plattform in
`ai/runtime/` und erstellt die Pi-Bridge mit esbuild. Nutzer müssen dann kein
separates Node installieren. Die **Release-Binaries müssen noch mit echten
Konten auf allen drei Betriebssystemen getestet werden**, bevor man sie als
stabil weitergeben sollte.

## Datenschutz und Sicherheit

- Keine Authentifizierung über Browser-Cookies, Session-Scraping oder API-Key.
- Bridge-Code wird lokal ausgeführt; Token nicht an den React-Frontendprozess
  zurückgegeben.
- Zugang zum OAuth-Browseraufruf ist auf bekannte OpenAI-Domains beschränkt.
- `pi-oauth.json` wird unter StudyDeck-Appdaten gespeichert, nicht mit dem
  Projekt exportiert oder an Kommilitonen verteilt.
- Service-Limits und Bedingungen beachten; für kommerzielle Nutzung sind
  andere Berechtigungen möglich bzw. erforderlich.

## Bekannte Einschränkungen

- Kein CI-End-to-End-Test mit einem echten ChatGPT-Konto (manuelle Anmeldung
  erforderlich).
- Ein Teilauftrag benötigt unter Umständen mehrere Minuten, große PDFs
  entsprechend länger.
- Der Bildmodus in `openai-codex` muss verfügbar sein; sonst erscheint ein
  expliziter Fehler.
- Bei fehlgeschlagenem Modellaufruf gibt es **keine** kostenpflichtige
  Ersatzroute.
