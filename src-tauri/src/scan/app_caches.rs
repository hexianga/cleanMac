use std::fs;

use crate::model::{make_scan_item, SafetyLevel, ScanCategoryResult, ScanContext};
use crate::scan::walk::{dir_size, is_denied};
use crate::scan::Scanner;

pub struct AppCachesScanner;

impl Scanner for AppCachesScanner {
    fn id(&self) -> &'static str {
        "app_caches"
    }

    fn name(&self) -> &'static str {
        "应用缓存"
    }

    fn default_safety(&self) -> SafetyLevel {
        SafetyLevel::Safe
    }

    fn scan(&self, ctx: &ScanContext) -> Result<ScanCategoryResult, String> {
        let caches_dir = ctx.home.join("Library/Caches");
        let mut items = Vec::new();
        let mut warnings = Vec::new();

        if !caches_dir.is_dir() {
            return Ok(empty_result(self));
        }

        let entries = match fs::read_dir(&caches_dir) {
            Ok(entries) => entries,
            Err(error) => {
                warnings.push(format!("无法读取 {}: {error}", caches_dir.display()));
                return Ok(ScanCategoryResult {
                    scanner_id: self.id().into(),
                    name: self.name().into(),
                    safety_level: self.default_safety(),
                    items,
                    total_bytes: 0,
                    warnings,
                });
            }
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if is_denied(&path, &ctx.home) {
                continue;
            }

            let meta = match entry.metadata() {
                Ok(meta) => meta,
                Err(error) => {
                    warnings.push(format!("无法读取 {}: {error}", path.display()));
                    continue;
                }
            };

            if !meta.is_dir() {
                continue;
            }

            let size_bytes = match dir_size(&path) {
                Ok(size) => size,
                Err(error) => {
                    warnings.push(format!("无法统计 {}: {error}", path.display()));
                    continue;
                }
            };

            if size_bytes == 0 {
                continue;
            }

            items.push(make_scan_item(
                self.id(),
                &path,
                size_bytes,
                SafetyLevel::Safe,
                true,
                true,
            ));
        }

        items.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
        let total_bytes = items.iter().map(|item| item.size_bytes).sum();

        Ok(ScanCategoryResult {
            scanner_id: self.id().into(),
            name: self.name().into(),
            safety_level: self.default_safety(),
            items,
            total_bytes,
            warnings,
        })
    }
}

fn empty_result(scanner: &AppCachesScanner) -> ScanCategoryResult {
    ScanCategoryResult {
        scanner_id: scanner.id().into(),
        name: scanner.name().into(),
        safety_level: scanner.default_safety(),
        items: Vec::new(),
        total_bytes: 0,
        warnings: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn aggregates_top_level_cache_dirs() {
        let home = tempdir().unwrap();
        let caches = home.path().join("Library/Caches");
        let app_a = caches.join("AppA");
        let app_b = caches.join("AppB");
        fs::create_dir_all(app_a.join("nested")).unwrap();
        fs::create_dir_all(&app_b).unwrap();
        fs::write(app_a.join("nested/data.cache"), b"123456").unwrap();
        fs::write(app_b.join("tmp.cache"), b"12").unwrap();

        let ctx = ScanContext::with_home(home.path().to_path_buf());
        let result = AppCachesScanner.scan(&ctx).expect("scan");

        assert_eq!(result.items.len(), 2);
        assert_eq!(result.total_bytes, 8);
        assert!(result
            .items
            .iter()
            .any(|item| item.path.ends_with("AppA")));
    }
}
