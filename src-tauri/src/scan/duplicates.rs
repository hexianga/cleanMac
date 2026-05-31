use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;

use crate::model::{
    emit_scan_progress, make_scan_item_with_group, SafetyLevel, ScanCategoryResult, ScanContext,
    ScanItem,
};
use crate::scan::walk::{
    file_size_on_disk_from_metadata, is_denied, is_protected_path, logical_file_size,
};
use crate::scan::Scanner;

const HASH_PROGRESS_EVERY: usize = 32;

pub struct DuplicatesScanner;

impl Scanner for DuplicatesScanner {
    fn id(&self) -> &'static str {
        "duplicates"
    }

    fn name(&self) -> &'static str {
        "重复文件"
    }

    fn default_safety(&self) -> SafetyLevel {
        SafetyLevel::Review
    }

    fn scan(&self, ctx: &ScanContext) -> Result<ScanCategoryResult, String> {
        if !ctx.settings.scan_duplicates {
            return Ok(empty_result(self, vec!["重复文件扫描已在设置中关闭".into()]));
        }

        let min_bytes = ctx.settings.duplicate_min_bytes;
        let mut warnings = Vec::new();
        let mut by_size: HashMap<u64, Vec<PathBuf>> = HashMap::new();

        collect_files_by_size(
            &ctx.home,
            &ctx.home,
            min_bytes,
            ctx.settings.include_node_modules,
            &mut by_size,
            &mut warnings,
            ctx,
        );

        if is_cancelled(ctx) {
            return Ok(empty_result(self, warnings));
        }

        emit_scan_progress(ctx, "duplicates", "hashing", 0, 0);

        let mut items = Vec::new();
        let mut hashed_files = 0usize;
        let mut total_bytes = 0u64;

        for (_size, paths) in by_size {
            if paths.len() < 2 {
                continue;
            }

            let mut by_hash: HashMap<String, Vec<(PathBuf, u64)>> = HashMap::new();

            for path in paths {
                if is_cancelled(ctx) {
                    return Ok(partial_result(self, items, total_bytes, warnings));
                }

                let meta = match fs::metadata(&path) {
                    Ok(meta) => meta,
                    Err(error) => {
                        warnings.push(format!("无法读取 {}: {error}", path.display()));
                        continue;
                    }
                };

                if logical_file_size(&meta) > ctx.settings.max_hash_bytes {
                    continue;
                }

                let size_bytes = match file_size_on_disk_from_metadata(&meta) {
                    Ok(size) => size,
                    Err(error) => {
                        warnings.push(format!("无法读取 {}: {error}", path.display()));
                        continue;
                    }
                };

                let hash = match blake3_file(&path, ctx.settings.max_hash_bytes) {
                    Ok(hash) => hash,
                    Err(error) => {
                        warnings.push(format!("无法哈希 {}: {error}", path.display()));
                        continue;
                    }
                };

                hashed_files += 1;
                if hashed_files % HASH_PROGRESS_EVERY == 0 {
                    emit_scan_progress(ctx, "duplicates", "hashing", items.len() as u32, total_bytes);
                }

                by_hash
                    .entry(hash)
                    .or_default()
                    .push((path, size_bytes));
            }

            for (group_id, group_paths) in by_hash {
                if group_paths.len() < 2 {
                    continue;
                }

                for (path, size_bytes) in group_paths {
                    total_bytes += size_bytes;
                    items.push(make_scan_item_with_group(
                        self.id(),
                        &path,
                        size_bytes,
                        SafetyLevel::Review,
                        false,
                        true,
                        Some(group_id.clone()),
                    ));
                }
            }
        }

        emit_scan_progress(ctx, "duplicates", "hashing", items.len() as u32, total_bytes);

        items.sort_by(|a, b| {
            a.group_id
                .cmp(&b.group_id)
                .then_with(|| a.path.cmp(&b.path))
        });

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

fn empty_result(
    scanner: &DuplicatesScanner,
    warnings: Vec<String>,
) -> ScanCategoryResult {
    ScanCategoryResult {
        scanner_id: scanner.id().into(),
        name: scanner.name().into(),
        safety_level: scanner.default_safety(),
        items: Vec::new(),
        total_bytes: 0,
        warnings,
    }
}

fn partial_result(
    scanner: &DuplicatesScanner,
    items: Vec<ScanItem>,
    total_bytes: u64,
    warnings: Vec<String>,
) -> ScanCategoryResult {
    ScanCategoryResult {
        scanner_id: scanner.id().into(),
        name: scanner.name().into(),
        safety_level: scanner.default_safety(),
        items,
        total_bytes,
        warnings,
    }
}

fn is_cancelled(ctx: &ScanContext) -> bool {
    ctx.cancel
        .as_ref()
        .is_some_and(|cancel| cancel.load(Ordering::Relaxed))
}

fn collect_files_by_size(
    dir: &Path,
    home: &Path,
    min_bytes: u64,
    include_node_modules: bool,
    by_size: &mut HashMap<u64, Vec<PathBuf>>,
    warnings: &mut Vec<String>,
    ctx: &ScanContext,
) {
    if is_cancelled(ctx) || is_denied(dir, home) {
        return;
    }

    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) => {
            warnings.push(format!("无法读取 {}: {error}", dir.display()));
            return;
        }
    };

    for entry in entries.flatten() {
        if is_cancelled(ctx) {
            return;
        }

        let path = entry.path();
        if is_denied(&path, home) || is_protected_path(&path, home) {
            continue;
        }

        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(error) => {
                warnings.push(format!("无法读取 {}: {error}", path.display()));
                continue;
            }
        };

        if file_type.is_dir() {
            if should_skip_dir(&path, include_node_modules) {
                continue;
            }
            collect_files_by_size(
                &path,
                home,
                min_bytes,
                include_node_modules,
                by_size,
                warnings,
                ctx,
            );
            continue;
        }

        if !file_type.is_file() {
            continue;
        }

        let meta = match entry.metadata() {
            Ok(meta) => meta,
            Err(error) => {
                warnings.push(format!("无法读取 {}: {error}", path.display()));
                continue;
            }
        };

        let logical = logical_file_size(&meta);
        if logical > ctx.settings.max_hash_bytes {
            continue;
        }

        let allocated = match file_size_on_disk_from_metadata(&meta) {
            Ok(size) => size,
            Err(error) => {
                warnings.push(format!("无法读取 {}: {error}", path.display()));
                continue;
            }
        };

        if allocated >= min_bytes {
            by_size.entry(allocated).or_default().push(path);
        }
    }
}

fn should_skip_dir(path: &Path, include_node_modules: bool) -> bool {
    let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
        return false;
    };

    if name == ".git" {
        return true;
    }

    !include_node_modules && name == "node_modules"
}

fn blake3_file(path: &Path, max_bytes: u64) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = blake3::Hasher::new();
    let mut buffer = [0u8; 64 * 1024];
    let mut read_total = 0u64;

    loop {
        let read = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if read == 0 {
            break;
        }
        read_total += read as u64;
        if read_total > max_bytes {
            return Err("file exceeds max hash size".into());
        }
        hasher.update(&buffer[..read]);
    }

    Ok(hasher.finalize().to_hex().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::Settings;
    use std::fs;
    use std::sync::atomic::AtomicBool;
    use std::sync::Arc;
    use tempfile::tempdir;

    fn ctx_for_home(home: PathBuf) -> ScanContext {
        ScanContext {
            home,
            settings: Settings {
                large_file_min_bytes: 1024,
                duplicate_min_bytes: 1,
                include_node_modules: false,
                scan_duplicates: true,
                max_hash_bytes: 512 * 1024 * 1024,
                ..Settings::default()
            },
            cancel: None,
            on_progress: None,
        }
    }

    #[test]
    fn skips_when_disabled_in_settings() {
        let home = tempdir().unwrap();
        fs::write(home.path().join("a.txt"), b"same").unwrap();
        fs::write(home.path().join("b.txt"), b"same").unwrap();

        let mut ctx = ctx_for_home(home.path().to_path_buf());
        ctx.settings.scan_duplicates = false;
        let result = DuplicatesScanner.scan(&ctx).expect("scan");
        assert!(result.items.is_empty());
    }

    #[test]
    fn finds_duplicate_files() {
        let home = tempdir().unwrap();
        let content = b"same content for duplicate detection";
        fs::write(home.path().join("a.txt"), content).unwrap();
        fs::write(home.path().join("b.txt"), content).unwrap();

        let ctx = ctx_for_home(home.path().to_path_buf());
        let result = DuplicatesScanner.scan(&ctx).expect("scan");

        assert_eq!(result.scanner_id, "duplicates");
        assert_eq!(result.name, "重复文件");
        assert_eq!(result.safety_level, SafetyLevel::Review);
        assert_eq!(result.items.len(), 2);

        let group_id = result.items[0].group_id.clone().expect("group id");
        assert_eq!(result.items[1].group_id.as_deref(), Some(group_id.as_str()));
        assert!(!result.items[0].selected_by_default);
        assert!(!result.items[1].selected_by_default);
        assert!(result.items[0].deletable);
        assert!(result.items[1].deletable);
    }

    #[test]
    fn ignores_same_size_different_content() {
        let home = tempdir().unwrap();
        fs::write(home.path().join("a.txt"), b"alpha").unwrap();
        fs::write(home.path().join("b.txt"), b"bravo").unwrap();

        let ctx = ctx_for_home(home.path().to_path_buf());
        let result = DuplicatesScanner.scan(&ctx).expect("scan");

        assert!(result.items.is_empty());
    }

    #[test]
    fn respects_cancel_during_hash() {
        let home = tempdir().unwrap();
        let content = vec![7u8; 4096];
        for index in 0..8 {
            fs::write(home.path().join(format!("dup-{index}.bin")), &content).unwrap();
        }

        let cancel = Arc::new(AtomicBool::new(false));
        cancel.store(true, Ordering::Relaxed);

        let ctx = ScanContext {
            home: home.path().to_path_buf(),
            settings: Settings {
                large_file_min_bytes: 1024,
                duplicate_min_bytes: 1,
                include_node_modules: false,
                scan_duplicates: true,
                max_hash_bytes: 512 * 1024 * 1024,
                ..Settings::default()
            },
            cancel: Some(cancel),
            on_progress: None,
        };

        let result = DuplicatesScanner.scan(&ctx).expect("scan");
        assert!(result.items.is_empty());
    }
}
