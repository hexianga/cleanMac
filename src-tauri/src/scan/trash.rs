use std::fs;

use crate::model::{make_scan_item, SafetyLevel, ScanCategoryResult, ScanContext};
use crate::scan::Scanner;

pub struct TrashScanner;

impl Scanner for TrashScanner {
    fn id(&self) -> &'static str {
        "trash"
    }

    fn name(&self) -> &'static str {
        "废纸篓"
    }

    fn default_safety(&self) -> SafetyLevel {
        SafetyLevel::Safe
    }

    fn scan(&self, ctx: &ScanContext) -> Result<ScanCategoryResult, String> {
        let trash_dir = ctx.home.join(".Trash");
        let mut items = Vec::new();
        let mut warnings = Vec::new();

        if !trash_dir.is_dir() {
            return Ok(empty_result(self));
        }

        let entries = match fs::read_dir(&trash_dir) {
            Ok(entries) => entries,
            Err(error) => {
                warnings.push(format!("无法读取 {}: {error}", trash_dir.display()));
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
            let size_bytes = match entry.metadata() {
                Ok(meta) if meta.is_file() => meta.len(),
                Ok(_) => match crate::scan::walk::dir_size(&path) {
                    Ok(size) => size,
                    Err(error) => {
                        warnings.push(format!("无法统计 {}: {error}", path.display()));
                        continue;
                    }
                },
                Err(error) => {
                    warnings.push(format!("无法读取 {}: {error}", path.display()));
                    continue;
                }
            };

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

fn empty_result(scanner: &TrashScanner) -> ScanCategoryResult {
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
    fn lists_trash_items_fixture() {
        let home = tempdir().unwrap();
        let trash = home.path().join(".Trash");
        fs::create_dir_all(&trash).unwrap();
        fs::write(trash.join("old.txt"), b"abcd").unwrap();

        let ctx = ScanContext::with_home(home.path().to_path_buf());
        let result = TrashScanner.scan(&ctx).expect("scan");

        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].size_bytes, 4);
        assert_eq!(result.scanner_id, "trash");
    }
}
