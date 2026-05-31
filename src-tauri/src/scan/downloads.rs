use std::fs;
use std::path::Path;

use crate::model::{make_scan_item, SafetyLevel, ScanCategoryResult, ScanContext, ScanItem};
use crate::scan::walk::is_denied;
use crate::scan::Scanner;

const TARGET_EXTENSIONS: &[&str] = &["dmg", "pkg", "zip", "iso"];

pub struct DownloadsScanner;

impl Scanner for DownloadsScanner {
    fn id(&self) -> &'static str {
        "downloads"
    }

    fn name(&self) -> &'static str {
        "下载残留"
    }

    fn default_safety(&self) -> SafetyLevel {
        SafetyLevel::Safe
    }

    fn scan(&self, ctx: &ScanContext) -> Result<ScanCategoryResult, String> {
        let mut items = Vec::new();
        let mut warnings = Vec::new();

        for dir_name in ["Downloads", "Desktop"] {
            let dir = ctx.home.join(dir_name);
            if !dir.is_dir() {
                continue;
            }
            collect_installer_files(
                self.id(),
                &dir,
                &ctx.home,
                &mut items,
                &mut warnings,
            );
        }

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

fn has_target_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            TARGET_EXTENSIONS
                .iter()
                .any(|target| ext.eq_ignore_ascii_case(target))
        })
        .unwrap_or(false)
}

fn collect_installer_files(
    scanner_id: &str,
    dir: &Path,
    home: &Path,
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
        if is_denied(&path, home) {
            continue;
        }

        let meta = match entry.metadata() {
            Ok(meta) => meta,
            Err(error) => {
                warnings.push(format!("无法读取 {}: {error}", path.display()));
                continue;
            }
        };

        if meta.is_dir() {
            collect_installer_files(scanner_id, &path, home, items, warnings);
            continue;
        }

        if !meta.is_file() || !has_target_extension(&path) {
            continue;
        }

        items.push(make_scan_item(
            scanner_id,
            &path,
            meta.len(),
            SafetyLevel::Safe,
            true,
            true,
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn finds_installer_in_downloads_fixture() {
        let home = tempdir().unwrap();
        let downloads = home.path().join("Downloads");
        fs::create_dir_all(&downloads).unwrap();
        let dmg = downloads.join("foo.dmg");
        fs::write(&dmg, b"1234").unwrap();

        let ctx = ScanContext::with_home(home.path().to_path_buf());
        let result = DownloadsScanner.scan(&ctx).expect("scan");

        assert_eq!(result.scanner_id, "downloads");
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].path, dmg.display().to_string());
        assert_eq!(result.items[0].size_bytes, 4);
        assert!(result.items[0].selected_by_default);
    }

    #[test]
    fn finds_installers_on_desktop_and_downloads() {
        let home = tempdir().unwrap();
        let downloads = home.path().join("Downloads");
        let desktop = home.path().join("Desktop");
        fs::create_dir_all(&downloads).unwrap();
        fs::create_dir_all(&desktop).unwrap();
        fs::write(downloads.join("a.zip"), b"12").unwrap();
        fs::write(desktop.join("b.pkg"), b"345").unwrap();
        fs::write(downloads.join("notes.txt"), b"skip").unwrap();

        let ctx = ScanContext::with_home(home.path().to_path_buf());
        let result = DownloadsScanner.scan(&ctx).expect("scan");

        assert_eq!(result.items.len(), 2);
        assert_eq!(result.total_bytes, 5);
    }
}
