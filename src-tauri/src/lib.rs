mod app_identity;
#[cfg(test)]
mod test_home;
mod commands;
mod delete;
mod model;
mod permissions;
mod scan;
mod settings;

use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_| {
            app_identity::migrate_legacy_data();
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::get_disk_overview,
            commands::check_permissions,
            commands::open_full_disk_access_settings,
            commands::get_settings,
            commands::save_settings,
            commands::start_scan,
            commands::cancel_scan,
            commands::get_active_scanners,
            commands::get_scan_results,
            commands::reveal_in_finder,
            commands::delete_items,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
