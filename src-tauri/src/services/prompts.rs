//! Bearbeitbare Vorlagen für die StudyDeck-KI. Voreinstellungen bleiben im Programm,
//! persönliche Änderungen werden in der lokalen SQLite-Datenbank gespeichert.
use crate::models::{Card, PageText};
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use regex::{Captures, Regex};

pub type PromptOverrides = HashMap<String, String>;

pub const POLICY: &str = r#"
Du bist ein Experte für die Erstellung effizienter Anki-Karteikarten
für deutschsprachige technische Hochschulmodule.

OBERSTES ZIEL:
Erstelle Karteikarten, mit denen Studierende konzeptionelles
Verständnis aufbauen und klausurrelevantes Wissen langfristig behalten.

Die Karteikarten ergänzen Rechenübungen und ersetzen sie nicht.

GRUNDPRINZIP:
EINE KARTE = EINE KONKRETE FRAGE = EINE EINDEUTIGE ANTWORT.

FRAGEN:
- Stelle kurze, direkte und leicht verständliche Fragen.
- Bevorzuge einfache Hauptsätze.
- Eine Frage darf nur EIN klar abgegrenztes Lernziel prüfen.
- Vermeide verschachtelte Sätze und unnötig komplizierte Formulierungen.
- Vermeide mehrere Fragen innerhalb einer Karte.
- Frage nicht gleichzeitig nach Definition, Ursache und Anwendung.
- Die erwartete Antwort muss sofort aus der Frage hervorgehen.
- Jede Frage muss ohne die vorherige Karte verständlich sein.
- Verwende notwendige Fachbegriffe, aber keine unnötig komplizierte Sprache.
- Bevorzuge präzise Warum-, Was-, Wozu-, Wann- und Wie-Fragen.
- Teile umfangreiche Zusammenhänge in mehrere gezielte Karten.

ANTWORTEN:
- Beantworte die Frage unmittelbar.
- Schreibe vorzugsweise EINEN kurzen Satz.
- Maximal zwei kurze Sätze, sofern fachlich ausreichend.
- Keine langen Absätze und keine unnötigen Einleitungen.
- Keine Wiederholung der Frage.
- Keine unnötigen Beispiele oder Zusatzinformationen.
- Die Antwort muss vollständig, eindeutig und fachlich korrekt sein.
- Wichtige Randbedingungen dürfen nicht weggelassen werden.

ZUSÄTZLICHE ERKLÄRUNG:
- Verwende das Feld "explanation" nur, wenn eine zusätzliche
  Erklärung das Verständnis tatsächlich verbessert.
- Maximal 2 bis 3 kurze Sätze.
- Keine Wiederholung der Musterantwort.
- Falls keine Erklärung nötig ist, verwende einen leeren String.

KONZEPTUELLES VERSTÄNDNIS:
- Prüfe Ursachen, Wirkungen und grundlegende Zusammenhänge.
- Prüfe die Bedeutung physikalischer und technischer Konzepte.
- Prüfe Annahmen und Grenzen von Modellen.
- Prüfe, wann und warum bestimmte Methoden verwendet werden.
- Prüfe die qualitative Interpretation von Diagrammen und Ergebnissen.
- Bevorzuge Verständnisfragen statt reiner Faktenabfragen.

NICHT ERLAUBT:
- Isolierte Formelabfragen.
- Rechenaufgaben.
- Auswendiglernen von Rechenwegen.
- Unnötige Zahlenwerte.
- Unwichtige Details der Folien.
- Lange, komplexe Prüfungsfragen.
- Mehrere unabhängige Lernziele auf einer Karte.
- Fragen, deren erwartete Antwort unklar ist.

MATHEMATISCHE NOTATION:
- Nur verwenden, wenn sie das Verständnis vereinfacht.
- Verwende Anki-MathJax: \\(...\\) oder \\[...\\].
- Keine Dollarzeichen als Mathematikdelimiter.

KLAUSURORIENTIERUNG:
- Nutze das Modulprofil zur Priorisierung.
- Berücksichtige konzeptionelle Voraussetzungen typischer Klausuraufgaben.
- Auch bei rechenlastigen Modulen ausschließlich Verständnisfragen erstellen.
- Altklausuren sind Hinweise auf Schwerpunkte, keine vollständige Stoffliste.
- Keine Inhalte erfinden.
- Nur Aussagen erstellen, die durch das bereitgestellte Material gedeckt sind.

QUALITÄTSKONTROLLE:
Prüfe vor Ausgabe jede Karte:

1. Ist die Frage beim ersten Lesen verständlich?
2. Prüft sie genau EINEN Sachverhalt?
3. Ist eindeutig, welche Antwort erwartet wird?
4. Ist die Antwort so kurz wie sinnvoll möglich?
5. Ist die Karte fachlich korrekt?
6. Hilft sie beim Verständnis klausurrelevanter Konzepte?
7. Ist sie frei von unnötigen Informationen?

Falls eine Bedingung nicht erfüllt ist:
VEREINFACHE oder TEILE die Karte.

WICHTIG:
Lieber mehrere kurze, gezielte Karten als eine umfangreiche Karte.

Antworte AUSSCHLIESSLICH mit gültigem JSON gemäß Schema.
Keine Markdown-Codeblöcke und keine zusätzlichen Texte.
"#;
const PROFILE_TEMPLATE: &str = r###"{{policy}}
AUFGABE: Erstelle ein realistisches Modulprofil und Prüfungsstrategie. Modul: {{name}}, Semester: {{semester}}. {{exam_instruction}}. Gib unter evidence nur belegbare Hinweise an; ohne Altklausuren eine vorläufige Einschätzung ohne vorgetäuschte Klausurdetails.
ALT-KLAUSUREN:
{{evidence}}"###;
const PROFILE_MERGE_TEMPLATE: &str = r###"{{policy}}
Fasse die folgenden TEILANALYSEN aus visuell geprüften Altklausur-Seiten zu einem einzigen Modulprofil zusammen. Keine erfundenen Klausurdetails. Belege mit Dokumentnamen und Seitenzahlen erhalten. MODUL {{name}}, SEMESTER {{semester}}.
{{parts}}"###;
const CARDS_TEMPLATE: &str = r###"{{policy}}

MODUL:
{{module_name}}

MODULPROFIL:
{{profile}}

BEREITS ERSTELLTE KARTEN (NICHT DUPLIZIEREN):
{{previous_cards}}

ANKI-MODULSTAPEL – BISHERIGE FRAGEN:
{{anki_questions}}

HINWEISE:
{{hints}}

PDF-SEITEN:
(Textauszug nur ergänzend; die übergebenen Seitenbilder sind Hauptquelle.)

{{slides}}

AUFGABE:
{{task}}

AUSGABEFORMAT:

Erstelle die Karten entsprechend dem vorgegebenen JSON-Schema.

Für jede Karte:
- front: kurze, eindeutige Frage.
- back: direkte, knappe Musterantwort.
- explanation: optionale kurze Vertiefung oder leerer String.
- sourcePage: passende Foliennummer oder null.
- imagePage: nur falls ein Bild wirklich notwendig ist, sonst null.
- tags: kurze thematische Schlagwörter.

Die Vorderseite darf nicht unnötig kompliziert sein.
Die Rückseite darf keine langen Erklärungen enthalten.

Falls ein wichtiges Konzept mehrere Lernziele enthält:
Erstelle mehrere einzelne Karten.

Falls kein neues relevantes Lernziel vorhanden ist:
Gib ein leeres cards-Array zurück.

Keine Inhalte außerhalb des Materials erfinden."###;
const CARDS_TASK: &str = r###"
Analysiere die Vorlesungsfolien und erstelle klausurorientierte
Karteikarten für konzeptionelles Verständnis.

ARBEITSWEISE:

SCHRITT 1:
Identifiziere intern die wichtigsten klausurrelevanten Konzepte.

SCHRITT 2:
Zerlege jedes relevante Konzept in einzelne, klar abgegrenzte Lernziele.

SCHRITT 3:
Erstelle für jedes sinnvolle, noch nicht abgedeckte Lernziel
eine kurze, eindeutige Verständnisfrage.

SCHRITT 4:
Prüfe alle Karten auf Verständlichkeit, Kürze und Eindeutigkeit.

SCHRITT 5:
Entferne doppelte oder unwichtige Karten.

WICHTIG:
- Keine großen Sammelfragen.
- Keine langen Musterantworten.
- Nicht mehrere Konzepte in einer Frage bündeln.
- Lieber mehr kleine Karten als wenige überladene Karten.
- Die Anzahl der Karten richtet sich nach den Lernzielen,
  NICHT nach der Anzahl der Folien.
- Jede Karte muss einen eigenen Lernwert bieten.

BEISPIEL FÜR EINE SCHLECHTE KARTE:

Frage:
Warum kann ein teilweise gefülltes oder überlappendes Band
metallische Leitfähigkeit ermöglichen, während ein vollständig
gefülltes Valenzband mit leerem Leitungsband dies nicht kann?

Diese Frage ist zu lang und kombiniert mehrere Sachverhalte.

BESSERE AUFTEILUNG:

Karte 1:
Frage: Warum kann ein teilweise gefülltes Band Strom leiten?
Antwort: Weil Elektronen in freie Zustände innerhalb des Bandes wechseln können.

Karte 2:
Frage: Warum trägt ein vollständig gefülltes Band keinen Nettostrom?
Antwort: Weil die Beiträge der besetzten Zustände einander aufheben.

Karte 3:
Frage: Was verhindert bei einem Halbleiter den unmittelbaren
Übergang von Elektronen ins Leitungsband?
Antwort: Die Bandlücke, für deren Überwindung Energie benötigt wird.

Der Stil dieser Beispiele ist verbindlich.
Die Inhalte müssen aber immer aus den tatsächlich
bereitgestellten Folien stammen.
"###;
const CARDS_EXTRA_TASK: &str = r###"
Erstelle ergänzende Karteikarten zu dem ausdrücklich genannten Wunsch.

Berücksichtige die bereits vorhandenen Karten.
Erstelle nur Karten, die neue Lernaspekte abfragen.
Bevorzuge 1 bis 5 kurze, gezielte Verständnisfragen.
"###;
const REWRITE_TEMPLATE: &str = r###"{{policy}}

AUFGABE:
Überarbeite die folgende Anki-Karte.

ANWEISUNG:
{{instruction}}

BISHERIGE FRAGE:
{{front}}

BISHERIGE ANTWORT:
{{back}}

BISHERIGE ERKLÄRUNG:
{{explanation}}

ANDERE KARTEN:
{{other_cards}}

VERBINDLICHE REGELN:

- Behalte das ursprüngliche konzeptionelle Lernziel bei.
- Formuliere die Frage möglichst kurz und direkt.
- Genau eine klar erwartbare Antwort.
- Verwende einfache und verständliche Sprache.
- Entferne unnötige Details.
- Die Musterantwort soll idealerweise aus einem Satz bestehen.
- Zusätzliche Informationen gehören ins Erklärungsfeld.
- Vermeide Überschneidungen mit anderen Karten.
- Falls keine Erklärung nötig ist, verwende einen leeren String.
- Gib ausschließlich front, back und explanation gemäß JSON-Schema zurück."###;
const COVERAGE_TEMPLATE: &str = r###"{{policy}}
AUFGABE: Prüfe konservativ die KONZEPTUELLE THEMENABDECKUNG für Modul {{name}}, basierend auf visuell gelesenen Folien und vorhandenen Fragen. Keine mathematische Rechen- oder Formelabdeckung erwarten. 'covered' nur dann, wenn eine Karte tatsächlich das Konzept abfragt. 'missing' umfasst klausurrelevante Konzepte, die keine Karte ausreichend prüft; 'uncertain' wenn Folien unvollständig oder Grafik statt Text. Gib in overview die belegbare Abdeckung und etwaige Materialgrenzen an.
MODULPROFIL:
{{profile}}
VORLESUNGEN:
{{documents}}
BISHERIGE ENTWÜRFE/IMPORTE:
{{cards}}
BESTEHENDER ANKI-STAPEL:
{{anki_questions}}"###;
const COVERAGE_MERGE_TEMPLATE: &str = r###"{{policy}}
Fasse diese visuell geprüften TEIL-ABDECKUNGSBERICHTE zu einer moduleinheitlichen, konservativen Gesamtbewertung zusammen. Kein Thema erfinden.
{{parts}}"###;

fn default_profile_schema() -> Value {
    json!({"type":"object","additionalProperties":false,"required":["summary","examFocus","coreConcepts","questionStyle","excluded","evidence"],"properties":{"summary":{"type":"string"},"examFocus":{"type":"array","items":{"type":"string"}},"coreConcepts":{"type":"array","items":{"type":"string"}},"questionStyle":{"type":"array","items":{"type":"string"}},"excluded":{"type":"array","items":{"type":"string"}},"evidence":{"type":"array","items":{"type":"string"}}}})
}

fn default_cards_schema() -> serde_json::Value {
    serde_json::json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["cards"],
        "properties": {
            "cards": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                        "front",
                        "back",
                        "explanation",
                        "sourcePage",
                        "imagePage",
                        "tags"
                    ],
                    "properties": {
                        "front": { "type": "string" },
                        "back": { "type": "string" },
                        "explanation": { "type": "string" },
                        "sourcePage": { "type": ["integer", "null"] },
                        "imagePage": { "type": ["integer", "null"] },
                        "tags": {
                            "type": "array",
                            "items": { "type": "string" }
                        }
                    }
                }
            }
        }
    })
}

fn default_rewrite_schema() -> Value {
    json!({"type":"object","additionalProperties":false,"required":["front","back","explanation"],"properties":{"front":{"type":"string"},"back":{"type":"string"},"explanation":{"type":"string"}}})
}

fn default_coverage_schema() -> Value {
    json!({"type":"object","additionalProperties":false,"required":["overview","covered","missing","uncertain"],"properties":{"overview":{"type":"string"},"covered":{"type":"array","items":{"type":"string"}},"missing":{"type":"array","items":{"type":"string"}},"uncertain":{"type":"array","items":{"type":"string"}}}})
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptEntry {
    pub id: String,
    pub title: String,
    pub description: String,
    pub group: String,
    pub kind: String,
    pub placeholders: Vec<String>,
    pub default_value: String,
    pub value: String,
    pub customized: bool,
}

struct Definition {
    id: &'static str,
    title: &'static str,
    description: &'static str,
    group: &'static str,
    kind: &'static str,
    placeholders: &'static [&'static str],
    mandatory: &'static [&'static str],
}

const DEFINITIONS: &[Definition] = &[
    Definition { id: "policy", title: "Allgemeine KI-Regeln", description: "Gilt für alle KI-Aktionen: Kartenstil, Verständlichkeit und Qualitätskriterien.", group: "Grundlagen", kind: "text", placeholders: &[], mandatory: &[] },
    Definition { id: "profile", title: "Modulprofil aus Altklausuren", description: "Erzeugt die erste Analyse des Moduls.", group: "Modulprofil", kind: "template", placeholders: &["policy", "name", "semester", "exam_instruction", "evidence"], mandatory: &["policy", "evidence"] },
    Definition { id: "profile_merge", title: "Modulprofil zusammenführen", description: "Kombiniert mehrere Altklausur-Teilanalysen.", group: "Modulprofil", kind: "template", placeholders: &["policy", "name", "semester", "parts"], mandatory: &["policy", "parts"] },
    Definition { id: "cards", title: "Karteikarten – Promptaufbau", description: "Kombiniert Modulprofil, Folien, vorhandene Karten und Generierungsauftrag.", group: "Karteikarten", kind: "template", placeholders: &["policy", "module_name", "profile", "previous_cards", "anki_questions", "hints", "slides", "task"], mandatory: &["policy", "slides", "task"] },
    Definition { id: "cards_task", title: "Neue Karteikarten generieren", description: "Regelt Anzahl, Länge, Stil und Qualität der neuen Karten.", group: "Karteikarten", kind: "text", placeholders: &[], mandatory: &[] },
    Definition { id: "cards_extra_task", title: "Zusätzliche Karten generieren", description: "Regeln für gezielt zusätzlich angeforderte Karten.", group: "Karteikarten", kind: "text", placeholders: &[], mandatory: &[] },
    Definition { id: "rewrite", title: "Karte überarbeiten", description: "KI-Umschreiben einer vorhandenen Karte.", group: "Karteikarten", kind: "template", placeholders: &["policy", "instruction", "front", "back", "explanation", "other_cards"], mandatory: &["policy", "instruction", "front", "back"] },
    Definition { id: "coverage", title: "Themenabdeckung prüfen", description: "Vergleicht Vorlesungsinhalte mit vorhandenen Karten.", group: "Abdeckungsprüfung", kind: "template", placeholders: &["policy", "name", "profile", "documents", "cards", "anki_questions"], mandatory: &["policy", "documents", "cards"] },
    Definition { id: "coverage_merge", title: "Abdeckungsberichte zusammenführen", description: "Zusammenfassung großer Abdeckungsprüfungen.", group: "Abdeckungsprüfung", kind: "template", placeholders: &["policy", "parts"], mandatory: &["policy", "parts"] },
    Definition { id: "schema_profile", title: "JSON-Schema: Modulprofil", description: "Technisches Antwortformat für das Modulprofil.", group: "Erweitert · JSON", kind: "json", placeholders: &[], mandatory: &[] },
    Definition { id: "schema_cards", title: "JSON-Schema: Karteikarten", description: "Technisches Antwortformat für Karteikarten.", group: "Erweitert · JSON", kind: "json", placeholders: &[], mandatory: &[] },
    Definition { id: "schema_rewrite", title: "JSON-Schema: Überarbeitung", description: "Technisches Antwortformat für eine umformulierte Karte.", group: "Erweitert · JSON", kind: "json", placeholders: &[], mandatory: &[] },
    Definition { id: "schema_coverage", title: "JSON-Schema: Abdeckung", description: "Technisches Antwortformat der Themenabdeckung.", group: "Erweitert · JSON", kind: "json", placeholders: &[], mandatory: &[] },
];

fn definition(id: &str) -> Result<&'static Definition, String> {
    DEFINITIONS.iter().find(|d| d.id == id)
        .ok_or_else(|| "Unbekannter Prompt".to_string())
}

pub fn default_value(id: &str) -> Result<String, String> {
    let value = match id {
        "policy" => POLICY.to_string(),
        "profile" => PROFILE_TEMPLATE.to_string(),
        "profile_merge" => PROFILE_MERGE_TEMPLATE.to_string(),
        "cards" => CARDS_TEMPLATE.to_string(),
        "cards_task" => CARDS_TASK.to_string(),
        "cards_extra_task" => CARDS_EXTRA_TASK.to_string(),
        "rewrite" => REWRITE_TEMPLATE.to_string(),
        "coverage" => COVERAGE_TEMPLATE.to_string(),
        "coverage_merge" => COVERAGE_MERGE_TEMPLATE.to_string(),
        "schema_profile" => serde_json::to_string_pretty(&default_profile_schema()).unwrap_or_default(),
        "schema_cards" => serde_json::to_string_pretty(&default_cards_schema()).unwrap_or_default(),
        "schema_rewrite" => serde_json::to_string_pretty(&default_rewrite_schema()).unwrap_or_default(),
        "schema_coverage" => serde_json::to_string_pretty(&default_coverage_schema()).unwrap_or_default(),
        _ => return Err("Unbekannter Prompt".to_string()),
    };
    Ok(value)
}

pub fn entries(overrides: &PromptOverrides) -> Vec<PromptEntry> {
    DEFINITIONS.iter().map(|d| {
        let default_value = default_value(d.id).expect("registered prompt");
        let override_value = overrides.get(d.id);
        PromptEntry {
            id: d.id.to_string(), title: d.title.into(), description: d.description.into(),
            group: d.group.into(), kind: d.kind.into(),
            placeholders: d.placeholders.iter().map(|s| s.to_string()).collect(),
            value: override_value.cloned().unwrap_or_else(|| default_value.clone()),
            customized: override_value.is_some(), default_value,
        }
    }).collect()
}

/// Validate *before* persisting. PDF/card context placeholders must not disappear,
/// and the JSON schema must preserve the fields consumed by the Rust code.
pub fn validate(id: &str, value: &str) -> Result<(), String> {
    let d = definition(id)?;
    if value.trim().is_empty() { return Err("Ein Prompt darf nicht leer sein".into()); }
    if value.len() > 150_000 { return Err("Prompt ist zu lang (max. 150 KB)".into()); }
    if d.kind == "json" {
        let proposed: Value = serde_json::from_str(value)
            .map_err(|e| format!("Ungültiges JSON: {e}"))?;
        let original: Value = serde_json::from_str(&default_value(id)?)
            .map_err(|e| e.to_string())?;
        validate_schema_shape(&original, &proposed, id)?;
        return Ok(());
    }
    let re = Regex::new(r"\{\{([a-z_]+)\}\}").map_err(|e| e.to_string())?;
    for caps in re.captures_iter(value) {
        let key = &caps[1];
        if !d.placeholders.contains(&key) {
            return Err(format!("Unbekannter Platzhalter: {{{{{key}}}}}"));
        }
    }
    for key in d.mandatory {
        if !value.contains(&format!("{{{{{key}}}}}")) {
            return Err(format!("Notwendiger Platzhalter fehlt: {{{{{key}}}}}"));
        }
    }
    Ok(())
}

/// Preserve the expected API contract while allowing descriptions, hints and
/// optional constraints inside the JSON schemas to be customized.
fn validate_schema_shape(original: &Value, proposed: &Value, path: &str) -> Result<(), String> {
    if let Some(expected_type) = original.get("type") {
        if proposed.get("type") != Some(expected_type) {
            return Err(format!("Schema-Typ bei {path} darf nicht geändert werden"));
        }
    }
    if let Some(required) = original.get("required").and_then(Value::as_array) {
        let actual = proposed.get("required").and_then(Value::as_array)
            .ok_or_else(||format!("'required' fehlt bei {path}"))?;
        for item in required {
            if !actual.contains(item) {
                return Err(format!("Pflichtfeld {item} darf bei {path} nicht entfernt werden"));
            }
        }
    }
    if let Some(original_props) = original.get("properties").and_then(Value::as_object) {
        let actual_props = proposed.get("properties").and_then(Value::as_object)
            .ok_or_else(||format!("'properties' fehlt bei {path}"))?;
        for (key, expected) in original_props {
            let actual = actual_props.get(key)
                .ok_or_else(||format!("Schemafeld {path}.{key} darf nicht entfernt werden"))?;
            validate_schema_shape(expected, actual, &format!("{path}.{key}"))?;
        }
    }
    if let Some(original_items) = original.get("items") {
        let proposed_items = proposed.get("items")
            .ok_or_else(||format!("'items' fehlt bei {path}"))?;
        validate_schema_shape(original_items, proposed_items, &format!("{path}.items"))?;
    }
    Ok(())
}

pub fn effective(id: &str, overrides: &PromptOverrides) -> String {
    overrides.get(id).cloned().unwrap_or_else(|| default_value(id).unwrap_or_default())
}

/// Replace tokens in one pass: user-supplied PDFs and text cannot expand into more tokens.
fn render(id: &str, overrides: &PromptOverrides, values: &[(&str, String)]) -> String {
    let template = effective(id, overrides);
    let re = Regex::new(r"\{\{([a-z_]+)\}\}").expect("valid token regex");
    re.replace_all(&template, |caps: &Captures<'_>| {
        values.iter().find(|(k, _)| *k == &caps[1])
            .map(|(_, v)| v.clone()).unwrap_or_else(|| caps[0].to_string())
    }).into_owned()
}

pub fn schema(id: &str, overrides: &PromptOverrides) -> Value {
    serde_json::from_str(&effective(id, overrides)).unwrap_or_else(|_| {
        serde_json::from_str(&default_value(id).unwrap_or_default()).unwrap_or(json!({}))
    })
}

pub fn profile_schema(overrides: &PromptOverrides) -> Value { schema("schema_profile", overrides) }
pub fn cards_schema(overrides: &PromptOverrides) -> Value { schema("schema_cards", overrides) }
pub fn rewrite_schema(overrides: &PromptOverrides) -> Value { schema("schema_rewrite", overrides) }
pub fn coverage_schema(overrides: &PromptOverrides) -> Value { schema("schema_coverage", overrides) }

pub fn profile_prompt(overrides: &PromptOverrides, name: &str, semester: &str, exams: &[(String, Vec<PageText>)]) -> String {
    let evidence = exams.iter().map(|(n,p)| format!("DOKUMENT {n}\n{}", p.iter()
        .map(|x| format!("Seite {}: {}", x.page, x.text)).collect::<Vec<_>>().join("\n")))
        .collect::<Vec<_>>().join("\n\n");
    render("profile", overrides, &[
        ("policy", effective("policy", overrides)), ("name", name.into()),
        ("semester", semester.into()),
        ("exam_instruction", if exams.is_empty() {"Keine Altklausuren verfügbar"} else {"Analysiere die Aufgaben und ihre konzeptionellen Voraussetzungen"}.into()),
        ("evidence", clip(&evidence, 90000)),
    ])
}

pub fn profile_merge_prompt(overrides: &PromptOverrides, name: &str, semester: &str, part_results: &[Value]) -> String {
    render("profile_merge", overrides, &[
        ("policy", effective("policy", overrides)), ("name", name.into()),
        ("semester", semester.into()),
        ("parts", part_results.iter().map(Value::to_string).collect::<Vec<_>>().join("\n")),
    ])
}

pub fn cards_prompt(overrides: &PromptOverrides, module_name: &str, profile: Option<&Value>, pages: &[PageText],
    previous: &[Card], anki_questions: &[String], hints: &str, extra: bool) -> String {
    let slides = pages.iter().map(|p| format!("[FOLIE {}]\n{}", p.page, p.text)).collect::<Vec<_>>().join("\n");
    let existing = previous.iter().map(|c| format!("- {} => {}", c.front, clip(&c.back, 190))).collect::<Vec<_>>().join("\n");
    let anki = anki_questions.iter().map(|x| format!("- {x}")).collect::<Vec<_>>().join("\n");
    render("cards", overrides, &[
        ("policy", effective("policy", overrides)), ("module_name", module_name.into()),
        ("profile", profile.map(Value::to_string).unwrap_or_else(|| "Noch keine bestätigte Klausurgewichtung: grundlegende Verständnisthemen priorisieren.".into())),
        ("previous_cards", clip(&existing, 24000)), ("anki_questions", clip(&anki, 16000)),
        ("hints", hints.into()), ("slides", clip(&slides, 85000)),
        ("task", effective(if extra {"cards_extra_task"} else {"cards_task"}, overrides)),
    ])
}

pub fn rewrite_prompt(overrides: &PromptOverrides, card: &Card, instruction: &str, previous: &[Card]) -> String {
    let related = previous.iter().filter(|c| c.id != card.id).take(100).map(|c| c.front.as_str()).collect::<Vec<_>>().join("\n");
    render("rewrite", overrides, &[
        ("policy", effective("policy", overrides)), ("instruction", instruction.into()),
        ("front", card.front.clone()), ("back", card.back.clone()),
        ("explanation", card.explanation.clone()), ("other_cards", clip(&related, 12000)),
    ])
}

pub fn coverage_prompt(overrides: &PromptOverrides, name: &str, profile: Option<&Value>,
    documents: &[(String, Vec<PageText>)], cards: &[Card], anki_questions: &[String]) -> String {
    let slide_text = documents.iter().map(|(title,pages)| format!("DOKUMENT: {}\n{}", title,
        pages.iter().map(|p| format!("Seite {}: {}",p.page,p.text)).collect::<Vec<_>>().join("\n")))
        .collect::<Vec<_>>().join("\n\n");
    let local = cards.iter().map(|c| format!("FRAGE {}: {} / {}",c.status,c.front,clip(&c.back,160)))
        .collect::<Vec<_>>().join("\n");
    render("coverage", overrides, &[
        ("policy", effective("policy", overrides)), ("name", name.into()),
        ("profile", profile.map(Value::to_string).unwrap_or_default()),
        ("documents", clip(&slide_text, 95000)), ("cards", clip(&local, 32000)),
        ("anki_questions", clip(&anki_questions.join("\n"),16000)),
    ])
}

pub fn coverage_merge_prompt(overrides: &PromptOverrides, parts: &[Value]) -> String {
    render("coverage_merge", overrides, &[
        ("policy", effective("policy", overrides)),
        ("parts", parts.iter().map(Value::to_string).collect::<Vec<_>>().join("\n")),
    ])
}

pub fn clip(s: &str, max_chars: usize) -> String {
    if s.chars().count() <= max_chars { s.to_string() }
    else { format!("{}\n[Weitere Inhalte ausgelassen: Eingabe war länger als das Kontextlimit]", s.chars().take(max_chars).collect::<String>()) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn text_policy_contains_card_constraints() {
        assert!(POLICY.contains("EINE KARTE = EINE KONKRETE FRAGE"));
        assert!(validate("cards", &default_value("cards").unwrap()).is_ok());
    }
    #[test]
    fn can_edit_prompts_without_losing_context() {
        let mut overrides = PromptOverrides::new();
        overrides.insert("policy".into(), "Kurze Karten.".into());
        let pages = vec![PageText{ page: 3, text: "Halbleiter Bandlücke".into() }];
        let rendered = cards_prompt(&overrides, "Halbleiter", None, &pages, &[], &[], "einfach", false);
        assert!(rendered.contains("Kurze Karten."));
        assert!(rendered.contains("[FOLIE 3]"));
        assert!(rendered.contains("Halbleiter Bandlücke"));
        assert!(validate("cards", "Kein Kontext mehr").is_err());
        assert!(validate("schema_cards", "{falsches json").is_err());
    }
}
