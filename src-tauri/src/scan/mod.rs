pub mod app_caches;
pub mod dev_caches;
pub mod downloads;
pub mod duplicates;
pub mod large_files;
pub mod logs;
pub mod trash;
pub mod walk;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use rayon::prelude::*;
use tauri::{AppHandle, Emitter};

pub use crate::model::{
    SafetyLevel, ScanCategoryResult, ScanContext, ScanProgress,
};

pub trait Scanner: Send + Sync {
    fn id(&self) -> &'static str;
    fn name(&self) -> &'static str;
    fn default_safety(&self) -> SafetyLevel;
    fn scan(&self, ctx: &ScanContext) -> Result<ScanCategoryResult, String>;
}

pub struct ScanOrchestrator {
    scanners: Vec<Box<dyn Scanner>>,
}

impl ScanOrchestrator {
    pub fn m1() -> Self {
        Self {
            scanners: vec![
                Box::new(downloads::DownloadsScanner),
                Box::new(app_caches::AppCachesScanner),
                Box::new(trash::TrashScanner),
            ],
        }
    }

    pub fn m2() -> Self {
        Self {
            scanners: vec![
                Box::new(downloads::DownloadsScanner),
                Box::new(app_caches::AppCachesScanner),
                Box::new(trash::TrashScanner),
                Box::new(dev_caches::DevCachesScanner),
            ],
        }
    }

    pub fn m3() -> Self {
        Self {
            scanners: vec![
                Box::new(downloads::DownloadsScanner),
                Box::new(app_caches::AppCachesScanner),
                Box::new(trash::TrashScanner),
                Box::new(dev_caches::DevCachesScanner),
                Box::new(logs::LogsScanner),
            ],
        }
    }

    pub fn m4() -> Self {
        Self {
            scanners: vec![
                Box::new(large_files::LargeFilesScanner),
                Box::new(downloads::DownloadsScanner),
                Box::new(app_caches::AppCachesScanner),
                Box::new(trash::TrashScanner),
                Box::new(dev_caches::DevCachesScanner),
                Box::new(logs::LogsScanner),
            ],
        }
    }

    pub fn m5() -> Self {
        Self::full()
    }

    pub fn full() -> Self {
        Self {
            scanners: vec![
                Box::new(large_files::LargeFilesScanner),
                Box::new(duplicates::DuplicatesScanner),
                Box::new(downloads::DownloadsScanner),
                Box::new(app_caches::AppCachesScanner),
                Box::new(dev_caches::DevCachesScanner),
                Box::new(logs::LogsScanner),
                Box::new(trash::TrashScanner),
            ],
        }
    }

    pub fn by_ids(ids: &[&str]) -> Self {
        let full = Self::full();
        Self {
            scanners: full
                .scanners
                .into_iter()
                .filter(|s| ids.contains(&s.id()))
                .collect(),
        }
    }

    pub fn scanner_ids(&self) -> Vec<&'static str> {
        self.scanners.iter().map(|s| s.id()).collect()
    }

    pub fn name_for_id(id: &str) -> String {
        Self::full()
            .scanners
            .into_iter()
            .find(|s| s.id() == id)
            .map(|s| s.name().to_string())
            .unwrap_or_else(|| id.to_string())
    }

    pub fn run(
        &self,
        app: &AppHandle,
        cancel: &Arc<AtomicBool>,
        ctx: &ScanContext,
    ) -> Vec<ScanCategoryResult> {
        let progress_app = app.clone();
        let on_progress: crate::model::ProgressCallback = Arc::new(move |progress| {
            let _ = progress_app.emit("scan://progress", progress);
        });

        self.scanners
            .par_iter()
            .filter_map(|scanner| {
                if cancel.load(Ordering::Relaxed) {
                    return None;
                }

                let _ = app.emit(
                    "scan://progress",
                    ScanProgress {
                        scanner_id: scanner.id().to_string(),
                        phase: "scanning".into(),
                        items_found: 0,
                        total_bytes: 0,
                    },
                );

                let scan_ctx =
                    ctx.with_run_controls(Arc::clone(cancel), Arc::clone(&on_progress));

                let result = match scanner.scan(&scan_ctx) {
                    Ok(result) => result,
                    Err(error) => ScanCategoryResult {
                        scanner_id: scanner.id().to_string(),
                        name: scanner.name().to_string(),
                        safety_level: scanner.default_safety(),
                        items: Vec::new(),
                        total_bytes: 0,
                        warnings: vec![error],
                    },
                };

                let _ = app.emit(
                    "scan://progress",
                    ScanProgress {
                        scanner_id: scanner.id().to_string(),
                        phase: "done".into(),
                        items_found: result.items.len() as u32,
                        total_bytes: result.total_bytes,
                    },
                );

                Some(result)
            })
            .collect()
    }
}

#[cfg(test)]
mod orchestrator_tests {
    use super::*;

    #[test]
    fn by_ids_filters_scanners() {
        let orch = ScanOrchestrator::by_ids(&["downloads", "logs"]);
        let ids = orch.scanner_ids();
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&"downloads"));
        assert!(ids.contains(&"logs"));
        assert!(!ids.contains(&"large_files"));
    }

    #[test]
    fn by_ids_unknown_id_returns_empty() {
        let orch = ScanOrchestrator::by_ids(&["not_a_real_scanner"]);
        assert!(orch.scanner_ids().is_empty());
    }
}
