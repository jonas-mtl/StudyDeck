//! AnkiConnect calls are restricted to localhost; no account credentials or cloud API.
use crate::models::Card;
use serde_json::{json, Value};

const ENDPOINT: &str = "http://127.0.0.1:8765";
const MODEL: &str = "StudyDeck Concepts";

pub async fn call(action: &str, params: Value) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(18))
        .no_proxy()
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .post(ENDPOINT)
        .json(&json!({"action":action,"version":6,"params":params}))
        .send()
        .await
        .map_err(|_| {
            "Anki nicht erreichbar. Bitte Anki Desktop mit AnkiConnect öffnen.".to_string()
        })?;
    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Ungültige AnkiConnect-Antwort: {e}"))?;
    if let Some(err) = body.get("error").and_then(Value::as_str) {
        return Err(format!("AnkiConnect: {err}"));
    }
    body.get("result")
        .cloned()
        .ok_or_else(|| "AnkiConnect hat kein Ergebnis geliefert".into())
}

pub fn deck_name(semester: &str, module_name: &str) -> String {
    format!("{}::{}", semester, module_name)
}

/// Own card type: works irrespective of Anki's UI language (Basic/Einfach/etc.).
pub async fn ensure_model() -> Result<(), String> {
    let models = call("modelNames", json!({})).await?;
    if models
        .as_array()
        .is_some_and(|xs| xs.iter().any(|x| x.as_str() == Some(MODEL)))
    {
        return Ok(());
    }
    call("createModel",json!({
        "modelName":MODEL,
        "inOrderFields":["Front","Back"],
        "css":".card {font-family:-apple-system,Arial,sans-serif; font-size:19px; color:#263247; text-align:left; padding:15px; line-height:1.55;} .card img{max-width:100%; height:auto;} hr#answer{border:0; border-top:1px solid #dbe2ea; margin:18px 0}",
        "cardTemplates":[{"Name":"Verständnis","Front":"{{Front}}","Back":"{{FrontSide}}<hr id=answer>{{Back}}"}]
    })).await?;
    Ok(())
}

pub async fn existing_questions(deck: &str) -> Result<Vec<String>, String> {
    let query = format!("deck:\"{}\"", deck.replace('"', ""));
    let ids = call("findNotes", json!({"query":query})).await?;
    let ids = ids.as_array().ok_or("Anki-Antwort ohne Notiz-IDs")?;
    let mut questions = Vec::new();
    for group in ids.chunks(100).take(10) {
        let notes = call("notesInfo", json!({"notes":group})).await?;
        for n in notes.as_array().into_iter().flatten() {
            // Existing decks can use German/localized or custom note types.
            let fields = n.get("fields").and_then(Value::as_object);
            let front = n
                .pointer("/fields/Front/value")
                .and_then(Value::as_str)
                .or_else(|| {
                    fields
                        .and_then(|obj| {
                            obj.values().min_by_key(|v| {
                                v.get("order").and_then(Value::as_i64).unwrap_or(i64::MAX)
                            })
                        })
                        .and_then(|v| v.get("value"))
                        .and_then(Value::as_str)
                });
            if let Some(front) = front {
                let plain = regex::Regex::new(r"<[^>]+>")
                    .unwrap()
                    .replace_all(front, " ")
                    .to_string();
                questions.push(plain.chars().take(350).collect());
            }
        }
    }
    Ok(questions)
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn display_text(s: &str) -> String {
    // Deliberately tiny Markdown subset; preserve Anki MathJax delimiters verbatim.
    let escaped = escape_html(s);
    let bold = regex::Regex::new(r"\*\*(.+?)\*\*").unwrap();
    bold.replace_all(&escaped, "<strong>$1</strong>")
        .replace('\n', "<br>")
}

pub async fn add_card(deck: &str, card: &Card, module: &str) -> Result<i64, String> {
    let mut back = display_text(&card.back);
    if !card.explanation.trim().is_empty() {
        back.push_str(&format!(
            "<hr><div style=\"color:#697586\">{}</div>",
            display_text(&card.explanation)
        ));
    }
    if let Some(image) = &card.image_data {
        let name = format!(
            "studydeck-{}-{}.png",
            &card.id,
            card.image_page.unwrap_or(0)
        );
        let data = image
            .strip_prefix("data:image/png;base64,")
            .ok_or("Bilddaten müssen PNG sein")?;
        call("storeMediaFile", json!({"filename":name,"data":data})).await?;
        back.push_str(&format!("<br><img src=\"{}\">", name));
    }
    if let Some(name) = &card.source_name {
        let source = match card.source_page {
            Some(page) => format!("{} · Folie {}", name, page),
            None => name.clone(),
        };
        back.push_str(&format!(
            "<br><small style=\"color:#9299a5\">Quelle: {}</small>",
            escape_html(&source)
        ));
    } else if let Some(page) = card.source_page {
        back.push_str(&format!(
            "<br><small style=\"color:#9299a5\">Quelle: Folie {page}</small>"
        ));
    }
    let mut tags = card
        .tags
        .iter()
        .map(|t| t.replace(' ', "_").replace('/', "_"))
        .filter(|t| !t.is_empty())
        .collect::<Vec<_>>();
    tags.push("StudyDeck".into());
    tags.push(module.replace(' ', "_"));
    let note = json!({"deckName":deck,"modelName":MODEL,"fields":{"Front":display_text(&card.front),"Back":back},"options":{"allowDuplicate":false},"tags":tags});
    let result = call("addNote", json!({"note":note})).await?;
    result
        .as_i64()
        .ok_or_else(|| "Anki hat keine Notiz-ID zurückgegeben (Duplikat?)".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn mathjax_is_kept() {
        assert!(display_text(r"\(x(t)\)").contains(r"\(x(t)\)"));
    }
    #[test]
    fn html_is_escaped() {
        assert!(!display_text("<script>").contains("<script>"));
    }
}
