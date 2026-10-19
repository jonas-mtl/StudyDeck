mod commands;
mod db;
mod models;
mod services;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
            if let Ok(resources) = app.path().resource_dir() {
                std::env::set_var("STUDYDECK_RESOURCE_DIR", resources);
            }
            let state = db::open(directory)?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::system::connection_status,
            commands::system::begin_ai_login,
            commands::system::ai_login_state,
            commands::system::submit_ai_auth_code,
            commands::system::logout_ai,
            commands::modules::list_modules,
            commands::modules::create_module,
            commands::modules::delete_module,
            commands::modules::list_documents,
            commands::modules::save_document,
            commands::modules::get_document_pdf,
            commands::modules::generate_profile,
            commands::modules::audit_coverage,
            commands::cards::list_cards,
            commands::cards::generate_cards,
            commands::cards::add_manual_card,
            commands::cards::generate_extra_card,
            commands::cards::rewrite_card,
            commands::cards::update_card,
            commands::cards::delete_card,
            commands::cards::attach_card_image,
            commands::cards::import_cards,
        ])
        .run(tauri::generate_context!())
        .expect("StudyDeck konnte nicht gestartet werden");
}
