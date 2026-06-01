use std::fs;
use std::path::Path;

use crate::model::{make_scan_item, SafetyLevel, ScanCategoryResult, ScanContext, ScanItem};
use crate::scan::walk::dir_size;
use crate::scan::Scanner;

pub struct ApplicationsScanner;

impl Scanner for ApplicationsScanner {
    fn id(&self) -> &'static str {
        "applications"
    }

    fn name(&self) -> &'static str {
        "应用程序"
    }

    fn default_safety(&self) -> SafetyLevel {
        SafetyLevel::Review
    }

    fn scan(&self, ctx: &ScanContext) -> Result<ScanCategoryResult, String> {
        let mut items = Vec::new();
        let mut warnings = Vec::new();

        let system_apps = Path::new("/Applications");
        if system_apps.is_dir() {
            collect_apps_in_dir(system_apps, self.id(), &mut items, &mut warnings);
        } else {
            warnings.push(
                "无法读取 /Applications，请在系统设置中授予完全磁盘访问权限".into(),
            );
        }

        let user_apps = ctx.home.join("Applications");
        if user_apps.is_dir() {
            collect_apps_in_dir(&user_apps, self.id(), &mut items, &mut warnings);
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

fn collect_apps_in_dir(
    dir: &Path,
    scanner_id: &str,
    items: &mut Vec<ScanItem>,
    warnings: &mut Vec<String>,
) {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) => {
            warnings.push(format!("无法读取 {}: {error}", dir.display()));
            return;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let is_app_bundle = path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.eq_ignore_ascii_case("app"))
            .unwrap_or(false);

        if !is_app_bundle {
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
                warnings.push(format!("无法计算大小 {}: {error}", path.display()));
                continue;
            }
        };

        items.push(make_scan_item(
            scanner_id,
            &path.to_path_buf(),
            size_bytes,
            SafetyLevel::Review,
            false,
            true,
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn lists_app_bundles_in_applications_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let apps = tmp.path().join("Applications");
        fs::create_dir_all(apps.join("Foo.app")).unwrap();
        fs::write(apps.join("Foo.app").join("dummy"), b"hello").unwrap();

        let mut items = Vec::new();
        let mut warnings = Vec::new();
        collect_apps_in_dir(&apps, "applications", &mut items, &mut warnings);

        assert_eq!(items.len(), 1);
        assert!(items[0].path.ends_with("Foo.app"));
        assert!(items[0].size_bytes > 0);
    }
}
