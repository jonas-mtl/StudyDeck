use crate::{
    db::{self, AppState},
    models::{Card, CardPatch, ImportResult},
    services::{anki, pi, prompts},
};
use serde::Deserialize;
use serde_json::Value;
use tauri::State;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SuggestedCard {
    front: String,
    back: String,
    explanation: String,
    source_page: Option<i64>,
    image_page: Option<i64>,
    tags: Vec<String>,
}

fn normalize(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
}

#[tauri::command]
pub fn list_cards(state: State<'_, AppState>, module_id: String) -> Result<Vec<Card>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::cards(&db, &module_id)
}

#[tauri::command]
pub fn add_manual_card(
    state: State<'_, AppState>,
    module_id: String,
    front: String,
    back: String,
    explanation: String,
) -> Result<Card, String> {
    if front.trim().is_empty() || back.trim().is_empty() {
        return Err("Frage und Antwort müssen ausgefüllt sein".into());
    }
    let c = Card {
        id: db::uid(),
        module_id,
        batch_id: None,
        front,
        back,
        explanation,
        source_page: None,
        image_page: None,
        image_data: None,
        source_name: None,
        tags: vec!["manuell".into()],
        status: "draft".into(),
        anki_note_id: None,
        created_at: db::now(),
    };
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::insert_card(&db, &c)?;
    Ok(c)
}

async fn generate_impl(
    state: State<'_, AppState>,
    module_id: String,
    document_id: String,
    from_page: i64,
    to_page: i64,
    hints: String,
    visuals: Vec<pi::VisualPage>,
    extra: bool,
) -> Result<Vec<Card>, String> {
    if from_page < 1 || to_page < from_page {
        return Err("Ungültiger Folienbereich".into());
    }
    let (module, pages, previous, document_name) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let m = db::module(&db, &module_id)?;
        let (owner, _, all_pages) = db::document_data(&db, &document_id)?;
        let doc_name = db::documents(&db, &module_id)?
            .into_iter()
            .find(|d| d.id == document_id)
            .ok_or("PDF-Dokument nicht gefunden")?
            .name;
        if owner != module_id {
            return Err("PDF gehört nicht zum gewählten Modul".into());
        }
        let pages = all_pages
            .into_iter()
            .filter(|p| p.page >= from_page && p.page <= to_page)
            .collect::<Vec<_>>();
        if pages.is_empty() {
            return Err("Im angegebenen Bereich liegen keine PDF-Seiten".into());
        }
        (m, pages, db::cards(&db, &module_id)?, doc_name)
    };
    // The user explicitly requested the current Anki cards as context. Never silently omit that check.
    let deck = anki::deck_name(&module.semester, &module.name);
    let anki_questions = anki::existing_questions(&deck).await?;
    // Fail closed: every selected PDF page must reach the multimodal model as an image.
    let page_set = pages
        .iter()
        .map(|p| p.page)
        .collect::<std::collections::HashSet<_>>();
    let visual_set = visuals
        .iter()
        .map(|v| v.page)
        .collect::<std::collections::HashSet<_>>();
    if page_set != visual_set || visuals.len() != pages.len() {
        return Err("Die visuelle PDF-Analyse ist unvollständig. Bitte Seiten erneut rendern; es wird NICHT auf reine Textextraktion zurückgefallen.".into());
    }
    let mut seen = previous
        .iter()
        .map(|c| normalize(&c.front))
        .collect::<std::collections::HashSet<_>>();
    seen.extend(anki_questions.iter().map(|s| normalize(s)));
    let mut accepted: Vec<Card> = vec![];
    let mut context_cards = previous.clone();
    let directory = state.data_dir.clone();
    for chunk in pages.chunks(30) {
        let chunk_set = chunk
            .iter()
            .map(|p| p.page)
            .collect::<std::collections::HashSet<_>>();
        let images = visuals
            .iter()
            .filter(|v| chunk_set.contains(&v.page))
            .cloned()
            .collect::<Vec<_>>();
        let prompt = prompts::cards_prompt(
            &module.name,
            module.profile.as_ref(),
            chunk,
            &context_cards,
            &anki_questions,
            &hints,
            extra,
        );
        let schema = prompts::cards_schema();
        let dir = directory.clone();
        let response =
            tauri::async_runtime::spawn_blocking(move || pi::run(&dir, &prompt, &schema, &images))
                .await
                .map_err(|e| e.to_string())??;
        let proposed: Vec<SuggestedCard> = serde_json::from_value(
            response
                .get("cards")
                .cloned()
                .ok_or("KI-Antwort ohne Karten")?,
        )
        .map_err(|e| format!("Kartenstruktur ungültig: {e}"))?;
        for mut s in proposed.into_iter().take(if extra { 3 } else { 18 }) {
            s.front = s.front.trim().to_string();
            s.back = s.back.trim().to_string();
            if s.front.is_empty() || s.back.is_empty() || s.front.len() > 800 || s.back.len() > 2300
            {
                continue;
            }
            let key = normalize(&s.front);
            if key.len() < 12 || !seen.insert(key) {
                continue;
            }
            let valid_page = |v: Option<i64>| v.filter(|n| chunk_set.contains(n));
            let card = Card {
                id: db::uid(),
                module_id: module_id.clone(),
                batch_id: None,
                front: s.front,
                back: s.back,
                explanation: s.explanation,
                source_page: valid_page(s.source_page),
                image_page: valid_page(s.image_page),
                image_data: None,
                source_name: Some(document_name.clone()),
                tags: s
                    .tags
                    .into_iter()
                    .take(5)
                    .map(|t| t.chars().take(45).collect())
                    .collect(),
                status: "draft".into(),
                anki_note_id: None,
                created_at: db::now(),
            };
            context_cards.push(card.clone());
            accepted.push(card);
            if accepted.len() >= (if extra { 3 } else { 60 }) {
                break;
            }
        }
        if accepted.len() >= (if extra { 3 } else { 60 }) {
            break;
        }
    }
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let batch = db::new_batch(
        &db,
        &module_id,
        Some(&document_id),
        from_page,
        to_page,
        &hints,
    )?;
    for c in &mut accepted {
        c.batch_id = Some(batch.clone());
        db::insert_card(&db, c)?;
    }
    Ok(accepted)
}

#[tauri::command]
pub async fn generate_cards(
    state: State<'_, AppState>,
    module_id: String,
    document_id: String,
    from_page: i64,
    to_page: i64,
    hints: String,
    visuals: Vec<pi::VisualPage>,
) -> Result<Vec<Card>, String> {
    generate_impl(
        state,
        module_id,
        document_id,
        from_page,
        to_page,
        hints,
        visuals,
        false,
    )
    .await
}

#[tauri::command]
pub async fn generate_extra_card(
    state: State<'_, AppState>,
    module_id: String,
    instruction: String,
    document_id: String,
    from_page: i64,
    to_page: i64,
    visuals: Vec<pi::VisualPage>,
) -> Result<Vec<Card>, String> {
    if instruction.trim().is_empty() {
        return Err("Beschreibe, welches Konzept du zusätzlich üben möchtest".into());
    }
    generate_impl(
        state,
        module_id,
        document_id,
        from_page,
        to_page,
        instruction,
        visuals,
        true,
    )
    .await
}

#[tauri::command]
pub async fn rewrite_card(
    state: State<'_, AppState>,
    card_id: String,
    instruction: String,
) -> Result<Value, String> {
    if instruction.trim().is_empty() {
        return Err("Bitte eine Umformulierungsanweisung eingeben".into());
    }
    let (card, prev) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let c = db::card(&db, &card_id)?;
        if c.status != "draft" {
            return Err("Nur Entwürfe können umformuliert werden".into());
        }
        let p = db::cards(&db, &c.module_id)?;
        (c, p)
    };
    let prompt = prompts::rewrite_prompt(&card, &instruction, &prev);
    let dir = state.data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        pi::run(&dir, &prompt, &prompts::rewrite_schema(), &[])
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn update_card(state: State<'_, AppState>, patch: CardPatch) -> Result<Card, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::update_card(&db, &patch)?;
    db::card(&db, &patch.id)
}
#[tauri::command]
pub fn delete_card(state: State<'_, AppState>, card_id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::soft_delete(&db, &card_id)
}
#[tauri::command]
pub fn attach_card_image(
    state: State<'_, AppState>,
    card_id: String,
    image_data: String,
    page: i64,
) -> Result<Card, String> {
    if !image_data.starts_with("data:image/png;base64,") {
        return Err("Nur PNG-Bilder erlaubt".into());
    }
    if image_data.len() > 7_000_000 {
        return Err("Angehängte Abbildung ist zu groß".into());
    }
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::image(&db, &card_id, &image_data, page)?;
    db::card(&db, &card_id)
}

#[tauri::command]
pub async fn import_cards(
    state: State<'_, AppState>,
    module_id: String,
    card_ids: Vec<String>,
) -> Result<ImportResult, String> {
    let (module, cards) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let module = db::module(&db, &module_id)?;
        let cards = card_ids
            .iter()
            .take(100)
            .map(|id| db::card(&db, id))
            .collect::<Result<Vec<_>, _>>()?;
        if cards.iter().any(|c| c.module_id != module_id) {
            return Err("Mindestens eine Karte gehört zu einem anderen Modul".into());
        }
        (module, cards)
    };
    let deck = anki::deck_name(&module.semester, &module.name);
    anki::call("createDeck", serde_json::json!({"deck":deck})).await?;
    anki::ensure_model().await?;
    let mut imported = vec![];
    let mut errors = vec![];
    for c in cards {
        if c.status != "draft" {
            continue;
        }
        match anki::add_card(&deck, &c, &module.name).await {
            Ok(note_id) => {
                let update = {
                    let db = state.db.lock().map_err(|e| e.to_string())?;
                    db::mark_imported(&db, &c.id, note_id)
                };
                match update {
                    Ok(()) => imported.push(c.id),
                    Err(e) => errors.push(format!(
                        "{}: Anki-Notiz {} erstellt, aber lokal nicht markiert: {e}",
                        c.front, note_id
                    )),
                }
            }
            Err(e) => errors.push(format!("{}: {e}", c.front)),
        }
    }
    Ok(ImportResult { imported, errors })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn dedupe_ignores_spacing() {
        assert_eq!(normalize("Warum LTI?"), normalize("WARUM   LTI !"));
    }
}
