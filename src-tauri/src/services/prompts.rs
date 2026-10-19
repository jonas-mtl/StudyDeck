//! Prompt policy: generated cards are a conceptual supplement to exercises, never a formula drill.
use crate::models::{Card, PageText};
use serde_json::{json, Value};

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

pub fn profile_prompt(name: &str, semester: &str, exams: &[(String, Vec<PageText>)]) -> String {
    let evidence = exams
        .iter()
        .map(|(n, p)| {
            format!(
                "DOKUMENT {n}\n{}",
                p.iter()
                    .map(|x| format!("Seite {}: {}", x.page, x.text))
                    .collect::<Vec<_>>()
                    .join("\n")
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n");
    format!("{POLICY}\nAUFGABE: Erstelle ein realistisches Modulprofil und Prüfungsstrategie. Modul: {name}, Semester: {semester}. {}. Gib unter evidence nur belegbare Hinweise an; ohne Altklausuren eine vorläufige Einschätzung ohne vorgetäuschte Klausurdetails.\nALT-KLAUSUREN:\n{}",if exams.is_empty(){"Keine Altklausuren verfügbar"}else{"Analysiere die Aufgaben und ihre konzeptionellen Voraussetzungen"},clip(&evidence,90000))
}

pub fn profile_merge_prompt(name: &str, semester: &str, part_results: &[Value]) -> String {
    format!("{POLICY}\nFasse die folgenden TEILANALYSEN aus visuell geprüften Altklausur-Seiten zu einem einzigen Modulprofil zusammen. Keine erfundenen Klausurdetails. Belege mit Dokumentnamen und Seitenzahlen erhalten. MODUL {name}, SEMESTER {semester}.\n{}",part_results.iter().map(Value::to_string).collect::<Vec<_>>().join("\n"))
}

pub fn profile_schema() -> Value {
    json!({"type":"object","additionalProperties":false,"required":["summary","examFocus","coreConcepts","questionStyle","excluded","evidence"],"properties":{"summary":{"type":"string"},"examFocus":{"type":"array","items":{"type":"string"}},"coreConcepts":{"type":"array","items":{"type":"string"}},"questionStyle":{"type":"array","items":{"type":"string"}},"excluded":{"type":"array","items":{"type":"string"}},"evidence":{"type":"array","items":{"type":"string"}}}})
}

pub fn cards_schema() -> serde_json::Value {
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

pub fn rewrite_schema() -> Value {
    json!({"type":"object","additionalProperties":false,"required":["front","back","explanation"],"properties":{"front":{"type":"string"},"back":{"type":"string"},"explanation":{"type":"string"}}})
}

pub fn cards_prompt(
    module_name: &str,
    profile: Option<&Value>,
    pages: &[PageText],
    previous: &[Card],
    anki_questions: &[String],
    hints: &str,
    extra: bool,
) -> String {
    let slides = pages
        .iter()
        .map(|p| format!("[FOLIE {}]\n{}", p.page, p.text))
        .collect::<Vec<_>>()
        .join("\n");

    let existing = previous
        .iter()
        .map(|c| format!("- {} => {}", c.front, clip(&c.back, 190)))
        .collect::<Vec<_>>()
        .join("\n");

    let anki = anki_questions
        .iter()
        .map(|x| format!("- {x}"))
        .collect::<Vec<_>>()
        .join("\n");

    let task = if extra {
        r#"
Erstelle ergänzende Karteikarten zu dem ausdrücklich genannten Wunsch.

Berücksichtige die bereits vorhandenen Karten.
Erstelle nur Karten, die neue Lernaspekte abfragen.
Bevorzuge 1 bis 5 kurze, gezielte Verständnisfragen.
"#
    } else {
        r#"
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
"#
    };

    format!(
        r#"{POLICY}

MODUL:
{module_name}

MODULPROFIL:
{}

BEREITS ERSTELLTE KARTEN (NICHT DUPLIZIEREN):
{}

ANKI-MODULSTAPEL – BISHERIGE FRAGEN:
{}

HINWEISE:
{}

PDF-SEITEN:
(Textauszug nur ergänzend; die übergebenen Seitenbilder sind Hauptquelle.)

{}

AUFGABE:
{}

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

Keine Inhalte außerhalb des Materials erfinden.
"#,
        profile.map(|x| x.to_string()).unwrap_or_else(|| {
            "Noch keine bestätigte Klausurgewichtung: \
                 grundlegende Verständnisthemen priorisieren."
                .into()
        }),
        clip(&existing, 24000),
        clip(&anki, 16000),
        hints,
        clip(&slides, 85000),
        task
    )
}

pub fn rewrite_prompt(card: &Card, instruction: &str, previous: &[Card]) -> String {
    let related = previous
        .iter()
        .filter(|c| c.id != card.id)
        .take(100)
        .map(|c| c.front.as_str())
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        r#"{POLICY}

AUFGABE:
Überarbeite die folgende Anki-Karte.

ANWEISUNG:
{instruction}

BISHERIGE FRAGE:
{}

BISHERIGE ANTWORT:
{}

BISHERIGE ERKLÄRUNG:
{}

ANDERE KARTEN:
{}

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
- Gib ausschließlich front, back und explanation gemäß JSON-Schema zurück.
"#,
        card.front,
        card.back,
        card.explanation,
        clip(&related, 12000)
    )
}

pub fn clip(s: &str, max_chars: usize) -> String {
    let size = s.chars().count();
    if size <= max_chars {
        s.to_string()
    } else {
        format!(
            "{}\n[Weitere Inhalte ausgelassen: Eingabe war länger als das Kontextlimit]",
            s.chars().take(max_chars).collect::<String>()
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn policy_forbids_memorizing_formulas() {
        assert!(POLICY.contains("KEINE isolierten Formeln"));
    }
    #[test]
    fn clipping_preserves_unicode_boundaries() {
        assert_eq!(
            clip("äöü", 2),
            "äö\n[Weitere Inhalte ausgelassen: Eingabe war länger als das Kontextlimit]"
        );
    }
}

pub fn coverage_schema() -> Value {
    json!({"type":"object","additionalProperties":false,"required":["overview","covered","missing","uncertain"],"properties":{"overview":{"type":"string"},"covered":{"type":"array","items":{"type":"string"}},"missing":{"type":"array","items":{"type":"string"}},"uncertain":{"type":"array","items":{"type":"string"}}}})
}

pub fn coverage_prompt(
    name: &str,
    profile: Option<&Value>,
    documents: &[(String, Vec<PageText>)],
    cards: &[Card],
    anki_questions: &[String],
) -> String {
    let slide_text = documents
        .iter()
        .map(|(title, pages)| {
            format!(
                "DOKUMENT: {}\n{}",
                title,
                pages
                    .iter()
                    .map(|p| format!("Seite {}: {}", p.page, p.text))
                    .collect::<Vec<_>>()
                    .join("\n")
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n");
    let local = cards
        .iter()
        .map(|c| format!("FRAGE {}: {} / {}", c.status, c.front, clip(&c.back, 160)))
        .collect::<Vec<_>>()
        .join("\n");
    format!("{POLICY}\nAUFGABE: Prüfe konservativ die KONZEPTUELLE THEMENABDECKUNG für Modul {name}, basierend auf visuell gelesenen Folien und vorhandenen Fragen. Keine mathematische Rechen- oder Formelabdeckung erwarten. 'covered' nur dann, wenn eine Karte tatsächlich das Konzept abfragt. 'missing' umfasst klausurrelevante Konzepte, die keine Karte ausreichend prüft; 'uncertain' wenn Folien unvollständig oder Grafik statt Text. Gib in overview die belegbare Abdeckung und etwaige Materialgrenzen an.\nMODULPROFIL:\n{}\nVORLESUNGEN:\n{}\nBISHERIGE ENTWÜRFE/IMPORTE:\n{}\nBESTEHENDER ANKI-STAPEL:\n{}",profile.map(|v|v.to_string()).unwrap_or_default(),clip(&slide_text,95000),clip(&local,32000),clip(&anki_questions.join("\n"),16000))
}
