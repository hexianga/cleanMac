use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::settings::Settings;

pub type ProgressCallback = Arc<dyn Fn(ScanProgress) + Send + Sync>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskOverview {
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub total_human: String,
    pub available_human: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SafetyLevel {
    Safe,
    Review,
    DisplayOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanItem {
    pub id: String,
    pub scanner_id: String,
    pub path: String,
    pub size_bytes: u64,
    pub size_human: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logical_size_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logical_size_human: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_category: Option<String>,
    pub safety_level: SafetyLevel,
    pub selected_by_default: bool,
    pub group_id: Option<String>,
    pub deletable: bool,
}

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanCategoryResult {
    pub scanner_id: String,
    pub name: String,
    pub safety_level: SafetyLevel,
    pub items: Vec<ScanItem>,
    pub total_bytes: u64,
    pub warnings: Vec<String>,
}

#[derive(Clone)]
pub struct ScanContext {
    pub home: PathBuf,
    pub settings: Settings,
    pub cancel: Option<Arc<AtomicBool>>,
    pub on_progress: Option<ProgressCallback>,
}

impl ScanContext {
    pub fn new() -> Result<Self, String> {
        dirs::home_dir()
            .ok_or_else(|| "无法定位用户主目录".to_string())
            .map(|home| Self {
                home,
                settings: crate::settings::load_settings(),
                cancel: None,
                on_progress: None,
            })
    }

    pub fn with_home(home: PathBuf) -> Self {
        Self {
            home,
            settings: Settings::default(),
            cancel: None,
            on_progress: None,
        }
    }

    pub fn with_settings(settings: Settings) -> Result<Self, String> {
        dirs::home_dir()
            .ok_or_else(|| "无法定位用户主目录".to_string())
            .map(|home| Self {
                home,
                settings,
                cancel: None,
                on_progress: None,
            })
    }

    pub fn with_run_controls(
        &self,
        cancel: Arc<AtomicBool>,
        on_progress: ProgressCallback,
    ) -> Self {
        Self {
            home: self.home.clone(),
            settings: self.settings.clone(),
            cancel: Some(cancel),
            on_progress: Some(on_progress),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub scanner_id: String,
    pub phase: String,
    pub items_found: u32,
    pub total_bytes: u64,
}

pub fn emit_scan_progress(
    ctx: &ScanContext,
    scanner_id: &str,
    phase: &str,
    items_found: u32,
    total_bytes: u64,
) {
    if let Some(callback) = &ctx.on_progress {
        callback(ScanProgress {
            scanner_id: scanner_id.into(),
            phase: phase.into(),
            items_found,
            total_bytes,
        });
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResultItem {
    pub item_id: String,
    pub success: bool,
    pub error: Option<String>,
}

pub fn make_scan_item(
    scanner_id: &str,
    path: &PathBuf,
    size_bytes: u64,
    safety_level: SafetyLevel,
    selected_by_default: bool,
    deletable: bool,
) -> ScanItem {
    make_scan_item_with_group(
        scanner_id,
        path,
        size_bytes,
        safety_level,
        selected_by_default,
        deletable,
        None,
    )
}

pub fn make_scan_item_with_group(
    scanner_id: &str,
    path: &PathBuf,
    size_bytes: u64,
    safety_level: SafetyLevel,
    selected_by_default: bool,
    deletable: bool,
    group_id: Option<String>,
) -> ScanItem {
    make_scan_item_full(
        scanner_id,
        path,
        size_bytes,
        None,
        None,
        safety_level,
        selected_by_default,
        deletable,
        group_id,
    )
}

pub fn make_scan_item_full(
    scanner_id: &str,
    path: &PathBuf,
    size_bytes: u64,
    logical_size_bytes: Option<u64>,
    file_category: Option<String>,
    safety_level: SafetyLevel,
    selected_by_default: bool,
    deletable: bool,
    group_id: Option<String>,
) -> ScanItem {
    let logical_size_human = logical_size_bytes.map(human_bytes);
    ScanItem {
        id: format!("{}:{}", scanner_id, path.display()),
        scanner_id: scanner_id.to_string(),
        path: path.display().to_string(),
        size_bytes,
        size_human: human_bytes(size_bytes),
        logical_size_bytes,
        logical_size_human,
        file_category,
        safety_level,
        selected_by_default,
        group_id,
        deletable,
    }
}

pub fn human_bytes(n: u64) -> String {
    const KB: u64 = 1024;
    if n >= KB * KB * KB {
        format!("{:.1} GB", n as f64 / (KB * KB * KB) as f64)
    } else if n >= KB * KB {
        format!("{:.1} MB", n as f64 / (KB * KB) as f64)
    } else {
        format!("{:.1} KB", n as f64 / KB as f64)
    }
}
