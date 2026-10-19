/**
 * Isolated Node bridge for the Pi multimodal library.
 * stdin/stdout are NOT used for secrets. Results go to a private job output file.
 * Credentials are stored only in the current user's StudyDeck app-data directory.
 * No OpenAI API key is requested or used.
 */

import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { getModels, complete } from "@earendil-works/pi-ai/compat";

import { loginOpenAICodex, getOAuthApiKey } from "@mariozechner/pi-ai/oauth";
import { join } from "node:path";

const [, , command, appDir, jobFile] = process.argv;
const authPath = join(appDir ?? ".", "pi-oauth.json");
const flowPath = join(appDir ?? ".", "pi-login-state.json");
const POLL_MS = 450;
let flowUpdates = Promise.resolve();

function updateLogin(mutator) {
  flowUpdates = flowUpdates.then(async () => {
    const current = await readJson(flowPath, {});
    const next = typeof mutator === "function" ? mutator(current) : mutator;
    await atomicJson(flowPath, next);
  });
  return flowUpdates;
}
async function atomicJson(path, data) {
  await mkdir(appDir, { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(data), { mode: 0o600 });
  await rename(temporary, path);
}
async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function credentials() {
  const all = await readJson(authPath, {});
  const own = all["openai-codex"];
  if (!own || own.type !== "oauth")
    throw new Error("Bitte zuerst in StudyDeck mit ChatGPT anmelden.");
  const token = await getOAuthApiKey("openai-codex", all);
  if (!token)
    throw new Error("ChatGPT-Anmeldung abgelaufen. Bitte erneut anmelden.");
  await atomicJson(authPath, {
    "openai-codex": { type: "oauth", ...token.newCredentials },
  });
  return token.apiKey;
}

async function login() {
  await updateLogin({
    phase: "opening",
    message: "OpenAI-Anmeldung wird vorbereitet.",
  });
  try {
    const credential = await loginOpenAICodex({
      onAuth: (info) => {
        const url = typeof info === "string" ? info : info.url;
        void updateLogin({
          phase: "browser",
          url,
          message:
            "Klicke auf „Im Browser anmelden“. StudyDeck wartet auf die Rückkehr.",
        });
      },
      onProgress: (message) => {
        void updateLogin((state) => ({
          ...state,
          phase: state.phase === "browser" ? "browser" : "waiting",
          message: String(message),
        }));
      },
      onPrompt: async ({ message }) => {
        // Fallback for browsers unable to call back to localhost:1455.
        await updateLogin({ phase: "code", message: String(message) });
        const codeFile = join(appDir, "pi-auth-code.txt");
        for (let i = 0; i < 600; i++) {
          const text = (
            await readFile(codeFile, "utf8").catch(() => "")
          ).trim();
          if (text) {
            await writeFile(codeFile, "", { mode: 0o600 });
            return text;
          }
          await new Promise((r) => setTimeout(r, POLL_MS));
        }
        throw new Error("Anmeldevorgang abgelaufen. Bitte erneut starten.");
      },
    });
    await atomicJson(authPath, {
      "openai-codex": { type: "oauth", ...credential },
    });
    await updateLogin({
      phase: "connected",
      message: "Mit ChatGPT angemeldet. Kein API-Key erforderlich.",
    });
  } catch (error) {
    await updateLogin({
      phase: "error",
      message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  }
}

function availableVisionModels() {
  return getModels("openai-codex").filter((m) => m.input?.includes("image"));
}

function modelForVision(requestedModel) {
  // Nur bildfähige Codex-Modelle
  const available = availableVisionModels();

  const requested = requestedModel || process.env.STUDYDECK_PI_MODEL;

  // Sinnvolle Reihenfolge: erst die 5.6-Modelle, dann 6er
  const preferred = [
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.6-luna",
    "gpt-6-sol",
    "gpt-6-astra",
    "gpt-6-luna",
    "gpt-6.1-sol",
    "gpt-5.5",
  ];

  let selected = null;

  if (requested) {
    selected = available.find((m) => m.id === requested) ?? null;
    if (!selected) {
      throw new Error(
        `STUDYDECK_PI_MODEL='${requested}' wurde gesetzt, aber ist nicht verfügbar. ` +
          `Verfügbare bildfähige Modelle: ${available.map((m) => m.id).join(", ")}`,
      );
    }
  } else {
    selected =
      preferred.map((id) => available.find((m) => m.id === id)).find(Boolean) ??
      null;
  }

  if (!selected) {
    throw new Error(
      "Kein passendes bildfähiges ChatGPT/Codex-Modell gefunden. " +
        "Verfügbare bildfähige Modelle: " +
        available.map((m) => m.id).join(", "),
    );
  }

  console.log("[StudyDeck] Vision-Modell:", selected.id);
  return selected;
}

if (!["login", "run", "models"].includes(command)) {
  console.error("Aufruf: bridge.mjs login <appDir> | run <appDir> <job.json> | models <appDir> <out.json>");
  process.exitCode = 1;
} else {
  await (command === "login" ? login() : command === "models" ? listModels() : run()).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

function repairInvalidJsonEscapes(jsonText) {
  // Repariert ungültige Escape-Sequenzen innerhalb
  // von JSON-Strings, beispielsweise \sigma oder \frac.

  let result = "";
  let inString = false;

  for (let i = 0; i < jsonText.length; i++) {
    const char = jsonText[i];

    if (char === "\\" && inString) {
      const next = jsonText[i + 1];

      // Gültige JSON-Escapes unverändert lassen
      if (next && '"\\/bfnrtu'.includes(next)) {
        result += char + next;
        i++;
        continue;
      }

      // Ungültigen Backslash maskieren
      result += "\\\\";
      continue;
    }

    if (char === '"') {
      inString = !inString;
    }

    result += char;
  }

  return result;
}

async function listModels() {
  if (!jobFile) throw new Error("Dateipfad für Modellliste fehlt");
  await atomicJson(jobFile, availableVisionModels().map(m => ({ id: m.id, name: m.name || m.id })));
}

async function run() {
  // 1. Auftrag laden
  const request = await readJson(jobFile, null);

  if (!request?.prompt || !request?.outFile) {
    throw new Error("Ungültiger KI-Auftrag.");
  }

  const visuals = request.visuals ?? [];

  // 2. Authentifizierung
  const token = await credentials();

  if (!token) {
    throw new Error("Keine gültige ChatGPT-Authentifizierung vorhanden.");
  }

  // 3. Modell auswählen
  const model = modelForVision(request.modelId);

  debug(`[StudyDeck] 4: Modell: ${model.id}`);

  // 4. Anfrage vorbereiten
  const content = [
    {
      type: "text",
      text: `${request.prompt}

Antworte ausschließlich mit einem einzigen gültigen JSON-Objekt.

Verwende exakt dieses JSON-Schema:
${JSON.stringify(request.schema)}

Wichtige Regeln:
- Kein Markdown.
- Keine Codeblöcke.
- Keine Erklärungen außerhalb des JSON.
- Alle erforderlichen Felder müssen vorhanden sein.
- Erzeuge vollständiges, syntaktisch gültiges JSON.
- Falls Informationen fehlen, verwende geeignete leere Werte.
- Erfinde keine Informationen, die nicht durch die Quellen belegt sind.`,
    },
  ];

  // 5. PDF-Seiten als Bilder hinzufügen
  for (const visual of visuals) {
    if (
      !Number.isInteger(visual.page) ||
      typeof visual.imageData !== "string"
    ) {
      throw new Error(`Ungültige PDF-Seite: ${visual.page}`);
    }

    const match = visual.imageData.match(
      /^data:image\/(jpeg|png);base64,(.+)$/s,
    );

    if (!match) {
      throw new Error(
        `PDF-Seite ${visual.page} enthält kein gültiges PNG/JPEG-Bild.`,
      );
    }

    const [, subtype, data] = match;

    content.push({
      type: "text",
      text: `PDF-SEITE ${visual.page}: Analysiere den Inhalt dieser Seite einschließlich Formeln, Diagrammen und Abbildungen.`,
    });

    content.push({
      type: "image",
      mimeType: `image/${subtype}`,
      data,
    });
  }

  // 6. KI-Anfrage
  const startTime = Date.now();

  const answer = await complete(
    model,
    {
      messages: [
        {
          role: "user",
          content,
          timestamp: Date.now(),
        },
      ],
    },
    {
      apiKey: token,
      maxTokens: 12000,
    },
  );

  const duration = Math.round((Date.now() - startTime) / 1000);

  // 7. Modellfehler prüfen
  if (answer.stopReason === "error" || answer.stopReason === "aborted") {
    const detail =
      typeof answer.errorMessage === "string" && answer.errorMessage.trim()
        ? answer.errorMessage.trim()
        : "Keine weiteren Modelldetails vorhanden";

    throw new Error(
      `Modellfehler (${answer.stopReason}, ${model.id}): ${detail}`,
    );
  }

  if (answer.stopReason === "length") {
    throw new Error(
      "Die KI-Antwort wurde wegen des Tokenlimits abgeschnitten. " +
        "Der Auftrag muss in kleinere Blöcke aufgeteilt werden.",
    );
  }

  // 8. Text aus Antwort extrahieren
  const text = (answer.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error(
      "Die KI hat keinen Antworttext geliefert. " +
        `StopReason: ${answer.stopReason}`,
    );
  }

  // 9. Markdown-Codeblock entfernen, falls vorhanden
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  // 10. JSON parsen
  let result;

  try {
    result = JSON.parse(cleaned);
  } catch (initialError) {
    const repaired = repairInvalidJsonEscapes(cleaned);

    try {
      result = JSON.parse(repaired);
    } catch (repairError) {
      throw new Error(
        `KI hat ungültiges JSON geliefert: ${repairError.message}`,
      );
    }
  }

  // 11. Grundstruktur überprüfen
  if (result === null || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Die KI hat kein JSON-Objekt zurückgegeben.");
  }

  // 12. Ergebnis speichern
  await atomicJson(request.outFile, result);
}
