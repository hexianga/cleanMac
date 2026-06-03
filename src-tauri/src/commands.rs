use std::collections::HashSet;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;

use crate::delete::{empty_trash, log_operation, trash_path};
use crate::model::{
    human_bytes, DeleteResultItem, DiskOverview, SafetyLevel, ScanCategoryResult, ScanContext,
    ScanItem,
};
use crate::permissions::{self, PermissionStatus};
use crate::scan::{walk, ScanOrchestrator};
use crate::settings::{self, Settings};

pub struct AppState {
    pub scan_results: Mutex<Option<Vec<ScanCategoryResult>>>,
    pub active_scanner_ids: Mutex<HashSet<String>>,
    pub cancel: Arc<AtomicBool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            scan_results: Mutex::new(None),
            active_scanner_ids: Mutex::new(HashSet::new()),
            cancel: Arc::new(AtomicBool::new(false)),
        }
    }
}

fn merge_scan_results(
    mut existing: Vec<ScanCategoryResult>,
    incoming: Vec<ScanCategoryResult>,
) -> Vec<ScanCategoryResult> {
    for new_cat in incoming {
        if let Some(pos) = existing
            .iter()
            .position(|c| c.scanner_id == new_cat.scanner_id)
        {
            existing[pos] = new_cat;
        } else {
            existing.push(new_cat);
        }
    }
    existing
}

#[tauri::command]
pub fn check_permissions() -> PermissionStatus {
    permissions::check_permissions()
}

#[tauri::command]
pub fn open_full_disk_access_settings(app: AppHandle) -> Result<(), String> {
    app.opener()
        .open_url(
            "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles",
            None::<&str>,
        )
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_disk_overview() -> Result<DiskOverview, String> {
    #[cfg(target_os = "macos")]
    {
        use std::ffi::CString;
        use std::mem::MaybeUninit;
        unsafe {
            let path = CString::new("/").map_err(|e| e.to_string())?;
            let mut stats: MaybeUninit<libc::statfs> = MaybeUninit::uninit();
            if libc::statfs(path.as_ptr(), stats.as_mut_ptr()) != 0 {
                return Err("statfs failed".into());
            }
            let stats = stats.assume_init();
            let block_size = stats.f_bsize as u64;
            let total = stats.f_blocks as u64 * block_size;
            let available = stats.f_bavail as u64 * block_size;
            return Ok(DiskOverview {
                total_bytes: total,
                available_bytes: available,
                total_human: human_bytes(total),
                available_human: human_bytes(available),
            });
        }
    }
    #[allow(unreachable_code)]
    Err("macOS only".into())
}

#[tauri::command]
pub fn get_settings() -> Settings {
    settings::load_settings()
}

#[tauri::command]
pub fn save_settings(settings: Settings) -> Result<(), String> {
    settings::save_settings(&settings)
}

#[tauri::command]
pub fn dev_scan_cache_exists(scanner_id: String) -> Result<bool, String> {
    crate::dev_cache::dev_cache_exists(&scanner_id)
}

#[tauri::command]
pub fn read_dev_scan_cache(scanner_id: String) -> Result<ScanCategoryResult, String> {
    crate::dev_cache::read_dev_cache(&scanner_id)
}

#[tauri::command]
pub async fn start_scan(
    app: AppHandle,
    state: State<'_, AppState>,
    scanner_ids: Vec<String>,
) -> Result<(), String> {
    if scanner_ids.is_empty() {
        return Err("请指定要扫描的类别".into());
    }

    {
        let mut active = state.active_scanner_ids.lock().map_err(|e| e.to_string())?;
        for id in &scanner_ids {
            if active.contains(id) {
                return Err(format!("「{id}」正在扫描中"));
            }
        }
        for id in &scanner_ids {
            active.insert(id.clone());
        }
    }

    state.cancel.store(false, Ordering::Relaxed);

    let ids_for_run: Vec<String> = scanner_ids.clone();
    let cancel = Arc::clone(&state.cancel);
    let app_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        let finish = |app: &AppHandle, ids: &[String]| {
            if let Some(st) = app.try_state::<AppState>() {
                let mut active = st.active_scanner_ids.lock().unwrap();
                for id in ids {
                    active.remove(id);
                }
            }
        };

        let ctx = match ScanContext::new() {
            Ok(ctx) => ctx,
            Err(error) => {
                if let Some(st) = app_handle.try_state::<AppState>() {
                    let error_results: Vec<ScanCategoryResult> = ids_for_run
                        .iter()
                        .map(|id| error_scan_category(id, &error))
                        .collect();
                    let mut guard = st.scan_results.lock().unwrap();
                    *guard = Some(merge_scan_results(
                        guard.clone().unwrap_or_default(),
                        error_results,
                    ));
                }
                finish(&app_handle, &ids_for_run);
                return;
            }
        };

        let id_refs: Vec<&str> = ids_for_run.iter().map(String::as_str).collect();
        let orchestrator = ScanOrchestrator::by_ids(&id_refs);
        let results = orchestrator.run(&app_handle, &cancel, &ctx);

        if let Some(st) = app_handle.try_state::<AppState>() {
            let mut guard = st.scan_results.lock().unwrap();
            let merged = merge_scan_results(guard.clone().unwrap_or_default(), results);
            *guard = Some(merged);
        }

        finish(&app_handle, &ids_for_run);
    });

    Ok(())
}

#[tauri::command]
pub fn cancel_scan(state: State<'_, AppState>) -> Result<(), String> {
    state.cancel.store(true, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub fn get_active_scanners(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    Ok(state
        .active_scanner_ids
        .lock()
        .map_err(|e| e.to_string())?
        .iter()
        .cloned()
        .collect())
}

#[tauri::command]
pub fn get_scan_results(
    state: State<'_, AppState>,
) -> Result<Option<Vec<ScanCategoryResult>>, String> {
    Ok(state
        .scan_results
        .lock()
        .map_err(|e| e.to_string())?
        .clone())
}

#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", path.as_str()])
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[allow(unreachable_code)]
    Err("macOS only".into())
}

#[tauri::command]
pub fn delete_items(
    state: State<'_, AppState>,
    item_ids: Vec<String>,
) -> Result<Vec<DeleteResultItem>, String> {
    if item_ids.is_empty() {
        return Ok(Vec::new());
    }

    let selected: HashSet<String> = item_ids.into_iter().collect();
    let mut trash_items: Vec<ScanItem> = Vec::new();
    let mut other_items: Vec<ScanItem> = Vec::new();

    {
        let results = state.scan_results.lock().map_err(|e| e.to_string())?;
        let results = results
            .as_ref()
            .ok_or_else(|| "没有可用的扫描结果".to_string())?;

        for category in results {
            for item in &category.items {
                if selected.contains(&item.id) {
                    if item.scanner_id == "trash" {
                        trash_items.push(item.clone());
                    } else {
                        other_items.push(item.clone());
                    }
                }
            }
        }
    }

    let home = ScanContext::new()?.home;
    let mut delete_results = Vec::new();

    for item in other_items {
        if let Some(blocked) = delete_blocked_reason(&item, &home) {
            delete_results.push(DeleteResultItem {
                item_id: item.id.clone(),
                success: false,
                error: Some(blocked),
            });
            continue;
        }
        delete_results.push(delete_one(&item));
    }

    if !trash_items.is_empty() {
        let all_trash_selected = is_all_trash_selected(&state, &trash_items)?;
        if all_trash_selected {
            match empty_trash(&home) {
                Ok(()) => {
                    for item in &trash_items {
                        log_operation(&item.scanner_id, &item.path, &Ok(()));
                    }
                    for item in trash_items {
                        delete_results.push(DeleteResultItem {
                            item_id: item.id,
                            success: true,
                            error: None,
                        });
                    }
                }
                Err(error) => {
                    let err = Err(error.clone());
                    for item in &trash_items {
                        log_operation(&item.scanner_id, &item.path, &err);
                    }
                    for item in trash_items {
                        delete_results.push(DeleteResultItem {
                            item_id: item.id,
                            success: false,
                            error: Some(error.clone()),
                        });
                    }
                }
            }
        } else {
            for item in trash_items {
                if let Some(blocked) = delete_blocked_reason(&item, &home) {
                    delete_results.push(DeleteResultItem {
                        item_id: item.id.clone(),
                        success: false,
                        error: Some(blocked),
                    });
                    continue;
                }
                delete_results.push(delete_trash_item(&item));
            }
        }
    }

    remove_deleted_items(&state, &delete_results)?;
    Ok(delete_results)
}

fn error_scan_category(scanner_id: &str, error: &str) -> ScanCategoryResult {
    ScanCategoryResult {
        scanner_id: scanner_id.to_string(),
        name: ScanOrchestrator::name_for_id(scanner_id),
        safety_level: SafetyLevel::Safe,
        items: Vec::new(),
        total_bytes: 0,
        warnings: vec![error.to_string()],
    }
}

fn delete_blocked_reason(item: &ScanItem, home: &Path) -> Option<String> {
    if !item.deletable {
        return Some("该项目不可删除".into());
    }
    let path = Path::new(&item.path);
    if walk::is_denied(path, home) || walk::is_protected_path(path, home) {
        return Some("受保护路径，无法删除".into());
    }
    None
}

fn delete_one(item: &ScanItem) -> DeleteResultItem {
    let result = trash_path(std::path::Path::new(&item.path));
    log_operation(&item.scanner_id, &item.path, &result);
    match result {
        Ok(()) => DeleteResultItem {
            item_id: item.id.clone(),
            success: true,
            error: None,
        },
        Err(error) => DeleteResultItem {
            item_id: item.id.clone(),
            success: false,
            error: Some(error),
        },
    }
}

fn delete_trash_item(item: &ScanItem) -> DeleteResultItem {
    let result = trash_path(std::path::Path::new(&item.path));
    log_operation(&item.scanner_id, &item.path, &result);
    match result {
        Ok(()) => DeleteResultItem {
            item_id: item.id.clone(),
            success: true,
            error: None,
        },
        Err(error) => DeleteResultItem {
            item_id: item.id.clone(),
            success: false,
            error: Some(error),
        },
    }
}

fn is_all_trash_selected(
    state: &State<'_, AppState>,
    selected_trash_items: &[ScanItem],
) -> Result<bool, String> {
    let results = state.scan_results.lock().map_err(|e| e.to_string())?;
    let results = results
        .as_ref()
        .ok_or_else(|| "没有可用的扫描结果".to_string())?;

    let trash_category = results
        .iter()
        .find(|category| category.scanner_id == "trash")
        .map(|category| category.items.len())
        .unwrap_or(0);

    Ok(trash_category > 0 && trash_category == selected_trash_items.len())
}

fn remove_deleted_items(
    state: &State<'_, AppState>,
    delete_results: &[DeleteResultItem],
) -> Result<(), String> {
    let deleted_ids: HashSet<&str> = delete_results
        .iter()
        .filter(|result| result.success)
        .map(|result| result.item_id.as_str())
        .collect();

    if deleted_ids.is_empty() {
        return Ok(());
    }

    let mut results = state.scan_results.lock().map_err(|e| e.to_string())?;
    let Some(categories) = results.as_mut() else {
        return Ok(());
    };

    for category in categories {
        category.items.retain(|item| !deleted_ids.contains(item.id.as_str()));
        category.total_bytes = category.items.iter().map(|item| item.size_bytes).sum();
    }

    Ok(())
}

#[tauri::command]
pub fn toggle_devtools(app: AppHandle) -> Result<(), String> {
    let webview = app
        .get_webview_window("main")
        .ok_or_else(|| "main webview not found".to_string())?;

    if webview.is_devtools_open() {
        webview.close_devtools();
    } else {
        webview.open_devtools();
    }
    Ok(())
}

#[cfg(test)]
mod merge_tests {
    use crate::model::{SafetyLevel, ScanCategoryResult};

    use super::merge_scan_results;

    fn cat(id: &str, bytes: u64) -> ScanCategoryResult {
        ScanCategoryResult {
            scanner_id: id.into(),
            name: id.into(),
            safety_level: SafetyLevel::Safe,
            items: vec![],
            total_bytes: bytes,
            warnings: vec![],
        }
    }

    #[test]
    fn merge_replaces_matching_scanner_only() {
        let existing = vec![cat("downloads", 100), cat("logs", 200)];
        let incoming = vec![cat("downloads", 999)];
        let merged = merge_scan_results(existing, incoming);
        assert_eq!(merged.len(), 2);
        let dl = merged.iter().find(|c| c.scanner_id == "downloads").unwrap();
        assert_eq!(dl.total_bytes, 999);
        let logs = merged.iter().find(|c| c.scanner_id == "logs").unwrap();
        assert_eq!(logs.total_bytes, 200);
    }
}

