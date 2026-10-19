use crate::{
    db::AppState,
    services::{anki, pi},
};
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub anki_connected: bool,
    pub anki_message: String,
    pub ai_connected: bool,
    pub ai_message: String,
}

#[tauri::command]
pub async fn connection_status(state: State<'_, AppState>) -> Result<Status, String> {
    let anki = anki::call("version", serde_json::json!({})).await;
    let connected = pi::connected(&state.data_dir);
    Ok(Status {
        anki_connected: anki.is_ok(),
        anki_message: anki
            .map(|v| format!("AnkiConnect v{v}"))
            .unwrap_or_else(|e| e),
        ai_connected: connected,
        ai_message: if connected {
            "ChatGPT-Konto verbunden (Pi OAuth)".into()
        } else {
            pi::login_state(&state.data_dir).message
        },
    })
}
#[tauri::command]
pub fn ai_login_state(state: State<'_, AppState>) -> pi::LoginState {
    pi::login_state(&state.data_dir)
}
#[tauri::command]
pub fn begin_ai_login(state: State<'_, AppState>) -> Result<(), String> {
    pi::begin_login(&state.data_dir)
}
#[tauri::command]
pub fn submit_ai_auth_code(state: State<'_, AppState>, code: String) -> Result<(), String> {
    pi::submit_code(&state.data_dir, &code)
}
#[tauri::command]
pub fn logout_ai(state: State<'_, AppState>) -> Result<(), String> {
    pi::logout(&state.data_dir)
}
