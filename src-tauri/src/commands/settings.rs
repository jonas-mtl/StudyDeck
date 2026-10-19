use crate::{db::{self, AiSettings, AppState}, services::pi};
use tauri::State;

#[tauri::command]
pub fn get_ai_settings(state: State<'_, AppState>) -> Result<AiSettings, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::ai_settings(&db)
}

#[tauri::command]
pub fn save_ai_settings(
    state: State<'_, AppState>,
    max_pages_per_request: usize,
    model_id: Option<String>,
) -> Result<AiSettings, String> {
    let settings = AiSettings { max_pages_per_request, model_id };
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::save_ai_settings(&db, &settings)?;
    Ok(settings)
}

#[tauri::command]
pub async fn list_ai_models(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, String> {
    let dir = state.data_dir.clone();
    tauri::async_runtime::spawn_blocking(move || pi::available_models(&dir))
        .await.map_err(|e| e.to_string())?
}
