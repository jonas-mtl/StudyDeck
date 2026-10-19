use crate::{db::{self, AppState}, services::prompts::{self, PromptEntry}};
use tauri::State;

#[tauri::command]
pub fn list_prompts(state: State<'_, AppState>) -> Result<Vec<PromptEntry>, String> {
    let db = state.db.lock().map_err(|e|e.to_string())?;
    Ok(prompts::entries(&db::prompt_overrides(&db)?))
}

#[tauri::command]
pub fn save_prompt(state: State<'_, AppState>, id: String, value: String) -> Result<PromptEntry, String> {
    prompts::validate(&id, &value)?;
    let db = state.db.lock().map_err(|e|e.to_string())?;
    // Avoid storing a redundant override if it matches the shipped default.
    if value == prompts::default_value(&id)? {
        db::reset_prompt_override(&db, &id)?;
    } else {
        db::save_prompt_override(&db, &id, &value)?;
    }
    prompts::entries(&db::prompt_overrides(&db)?)
        .into_iter().find(|entry| entry.id == id).ok_or_else(||"Unbekannter Prompt".into())
}

#[tauri::command]
pub fn reset_prompt(state: State<'_, AppState>, id: String) -> Result<PromptEntry, String> {
    prompts::default_value(&id)?;
    let db = state.db.lock().map_err(|e|e.to_string())?;
    db::reset_prompt_override(&db, &id)?;
    prompts::entries(&db::prompt_overrides(&db)?)
        .into_iter().find(|entry| entry.id == id).ok_or_else(||"Unbekannter Prompt".into())
}
