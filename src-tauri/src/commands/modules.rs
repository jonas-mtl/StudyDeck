use crate::{
    db::{self, AppState},
    models::{Document, Module, PageText},
    services::{pi, prompts},
};
use base64::Engine;
use tauri::State;

#[tauri::command]
pub fn list_modules(state: State<'_, AppState>) -> Result<Vec<Module>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::list_modules(&db)
}
#[tauri::command]
pub fn create_module(
    state: State<'_, AppState>,
    name: String,
    semester: String,
) -> Result<Module, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::create_module(&db, &name, &semester)
}
#[tauri::command]
pub fn list_documents(
    state: State<'_, AppState>,
    module_id: String,
) -> Result<Vec<Document>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::documents(&db, &module_id)
}

/// PDFs remain local inside Tauri app-data; extracted page text supports resumable runs.
#[tauri::command]
pub fn save_document(
    state: State<'_, AppState>,
    module_id: String,
    name: String,
    kind: String,
    pages: Vec<PageText>,
    pdf_base64: String,
) -> Result<Document, String> {
    if pages.is_empty() {
        return Err("Keine PDF-Seiten erkannt".into());
    }
    if pdf_base64.len() > 85_000_000 {
        return Err("PDF zu groß (maximal ca. 60 MB)".into());
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&pdf_base64)
        .map_err(|e| e.to_string())?;
    if !bytes.starts_with(b"%PDF-") {
        return Err("Datei ist keine gültige PDF".into());
    }
    // Idempotency: if the same PDF is already stored in this module under the
    // same document type, reuse its record. This also covers retries after an
    // interrupted or failed AI request; comparison uses bytes, not file names.
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        for existing in db::documents(&db, &module_id)? {
            if existing.kind != kind {
                continue;
            }
            let (_, existing_path, _) = db::document_data(&db, &existing.id)?;
            if let Ok(stored_bytes) = std::fs::read(&existing_path) {
                if stored_bytes == bytes {
                    return Ok(existing);
                }
            }
        }
    }
    let id = db::uid();
    let dir = state.data_dir.join("pdfs");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("{id}.pdf"));
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    let saved = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db::save_document(
            &db,
            &module_id,
            &name,
            &kind,
            &pages,
            &path.to_string_lossy(),
        )
    };
    if saved.is_err() {
        let _ = std::fs::remove_file(&path);
    }
    saved
}

#[tauri::command]
pub fn get_document_pdf(state: State<'_, AppState>, document_id: String) -> Result<String, String> {
    let (_, path, _) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db::document_data(&db, &document_id)?
    };
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

/// Every Altklausur page is required as a rendered image; text is only supplementary.
#[tauri::command]
pub async fn generate_profile(
    state: State<'_, AppState>,
    module_id: String,
    visual_documents: Vec<pi::DocumentVisuals>,
) -> Result<Module, String> {
    let (module, exams) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let module = db::module(&db, &module_id)?;
        let mut exams = vec![];
        for d in db::documents(&db, &module_id)?
            .into_iter()
            .filter(|d| d.kind == "exam")
        {
            let (_, _, pages) = db::document_data(&db, &d.id)?;
            exams.push((d.id, d.name, pages));
        }
        (module, exams)
    };
    let dir = state.data_dir.clone();
    let mut summaries = vec![];
    for (id, name, pages) in &exams {
        let supplied = visual_documents
            .iter()
            .find(|v| &v.document_id == id)
            .ok_or("Fehlende Altklausur-Bilder. PDF bitte visuell laden.")?;
        let expected = pages
            .iter()
            .map(|p| p.page)
            .collect::<std::collections::HashSet<_>>();
        let actual = supplied
            .pages
            .iter()
            .map(|p| p.page)
            .collect::<std::collections::HashSet<_>>();
        if expected != actual || supplied.pages.len() != pages.len() {
            return Err(format!(
                "Altklausur '{name}' wurde nicht vollständig visuell geladen"
            ));
        }
        for chunk in pages.chunks(30) {
            let included = chunk
                .iter()
                .map(|p| p.page)
                .collect::<std::collections::HashSet<_>>();
            let images = supplied
                .pages
                .iter()
                .filter(|p| included.contains(&p.page))
                .cloned()
                .collect::<Vec<_>>();
            let prompt = prompts::profile_prompt(
                &module.name,
                &module.semester,
                &[(name.clone(), chunk.to_vec())],
            );
            let schema = prompts::profile_schema();
            let dir = dir.clone();
            let result = tauri::async_runtime::spawn_blocking(move || {
                pi::run(&dir, &prompt, &schema, &images)
            })
            .await
            .map_err(|e| e.to_string())??;
            summaries.push(result);
        }
    }
    let result = if summaries.len() == 1 {
        summaries.remove(0)
    } else {
        let prompt = if exams.is_empty() {
            prompts::profile_prompt(&module.name, &module.semester, &[])
        } else {
            prompts::profile_merge_prompt(&module.name, &module.semester, &summaries)
        };
        let schema = prompts::profile_schema();
        let dir = state.data_dir.clone();
        tauri::async_runtime::spawn_blocking(move || pi::run(&dir, &prompt, &schema, &[]))
            .await
            .map_err(|e| e.to_string())??
    };
    // Validate basic structure before persisting a potentially truncated model response.
    for field in [
        "summary",
        "examFocus",
        "coreConcepts",
        "questionStyle",
        "excluded",
        "evidence",
    ] {
        if result.get(field).is_none() {
            return Err(format!("KI-Profil unvollständig: {field}"));
        }
    }
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::set_profile(&db, &module_id, &result)?;
    db::module(&db, &module_id)
}

/// Full-document visual audit, never text-only, no unannounced page clipping.
#[tauri::command]
pub async fn audit_coverage(
    state: State<'_, AppState>,
    module_id: String,
    visual_documents: Vec<pi::DocumentVisuals>,
) -> Result<serde_json::Value, String> {
    let (m, docs, cards) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let m = db::module(&db, &module_id)?;
        let mut docs = vec![];
        for d in db::documents(&db, &module_id)?
            .into_iter()
            .filter(|d| d.kind == "lecture")
        {
            let (_, _, pages) = db::document_data(&db, &d.id)?;
            docs.push((d.id, d.name, pages));
        }
        (m, docs, db::cards(&db, &module_id)?)
    };
    if docs.is_empty() {
        return Err("Bitte zuerst Vorlesungsfolien hochladen".into());
    }
    let existing = crate::services::anki::existing_questions(&crate::services::anki::deck_name(
        &m.semester,
        &m.name,
    ))
    .await?;
    let mut parts = vec![];
    for (id, name, pages) in &docs {
        let supplied = visual_documents
            .iter()
            .find(|v| &v.document_id == id)
            .ok_or("Für die Abdeckungsprüfung fehlen PDF-Seitenbilder")?;
        let expected = pages
            .iter()
            .map(|p| p.page)
            .collect::<std::collections::HashSet<_>>();
        let actual = supplied
            .pages
            .iter()
            .map(|p| p.page)
            .collect::<std::collections::HashSet<_>>();
        if expected != actual || supplied.pages.len() != pages.len() {
            return Err(format!("Visuelle Seiten von '{name}' unvollständig"));
        }
        for chunk in pages.chunks(30) {
            let set = chunk
                .iter()
                .map(|p| p.page)
                .collect::<std::collections::HashSet<_>>();
            let images = supplied
                .pages
                .iter()
                .filter(|p| set.contains(&p.page))
                .cloned()
                .collect::<Vec<_>>();
            let prompt = prompts::coverage_prompt(
                &m.name,
                m.profile.as_ref(),
                &[(name.clone(), chunk.to_vec())],
                &cards,
                &existing,
            );
            let schema = prompts::coverage_schema();
            let dir = state.data_dir.clone();
            let result = tauri::async_runtime::spawn_blocking(move || {
                pi::run(&dir, &prompt, &schema, &images)
            })
            .await
            .map_err(|e| e.to_string())??;
            parts.push(result);
        }
    }
    if parts.len() == 1 {
        return Ok(parts.remove(0));
    }
    let prompt=format!("{}\nFasse diese visuell geprüften TEIL-ABDECKUNGSBERICHTE zu einer moduleinheitlichen, konservativen Gesamtbewertung zusammen. Kein Thema erfinden.\n{}",prompts::POLICY,parts.iter().map(|p|p.to_string()).collect::<Vec<_>>().join("\n"));
    let schema = prompts::coverage_schema();
    let dir = state.data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || pi::run(&dir, &prompt, &schema, &[]))
        .await
        .map_err(|e| e.to_string())?
}

/// Local deletion only: imported Anki cards and decks remain untouched.
#[tauri::command]
pub fn delete_module(state: State<'_, AppState>, module_id: String) -> Result<(), String> {
    let paths = {
        let mut connection = state.db.lock().map_err(|e| e.to_string())?;
        db::delete_module(&mut connection, &module_id)?
    };
    // Only remove files stored under this application's own pdf directory.
    let folder = state.data_dir.join("pdfs");
    for path in paths {
        let candidate = std::path::PathBuf::from(path);
        if candidate.parent() == Some(folder.as_path()) {
            let _ = std::fs::remove_file(candidate);
        }
    }
    Ok(())
}
