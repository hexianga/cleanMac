use std::fs;
use std::path::Path;

use crate::model::{emit_scan_progress, make_scan_item_full, SafetyLevel, ScanCategoryResult, ScanContext, ScanItem};
use crate::scan::walk::{
    file_category, file_size_on_disk_from_metadata, is_denied, is_protected_path,
    is_sparse_file, logical_file_size,
};
use crate::scan::Scanner;

pub struct LargeFilesScanner;

impl Scanner for LargeFilesScanner {
    fn id(&self) -> &'static str {
        "large_files"
    }

    fn name(&self) -> &'static str {
        "大文件"
    }

    fn default_safety(&self) -> SafetyLevel {
        SafetyLevel::Review
    }

    fn scan(&self, ctx: &ScanContext) -> Result<ScanCategoryResult, String> {
        let mut items = Vec::new();
        let mut warnings = Vec::new();

        walk_large_files(
            &ctx.home,
            &ctx.home,
            ctx,
            ctx.settings.large_file_min_bytes,
            ctx.settings.include_node_modules,
            &mut items,
            &mut warnings,
            &mut 0u32,
        );

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

fn walk_large_files(
    dir: &Path,
    home: &Path,
    ctx: &ScanContext,
    min_bytes: u64,
    include_node_modules: bool,
    items: &mut Vec<ScanItem>,
    warnings: &mut Vec<String>,
    visited: &mut u32,
) {
    if is_denied(dir, home) {
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
        let path = entry.path();
        if is_denied(&path, home) {
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
            walk_large_files(
                &path,
                home,
                ctx,
                min_bytes,
                include_node_modules,
                items,
                warnings,
                visited,
            );
            continue;
        }

        if !file_type.is_file() {
            continue;
        }

        *visited += 1;
        if *visited % 100 == 0 {
            let total_bytes = items.iter().map(|item| item.size_bytes).sum();
            emit_scan_progress(
                ctx,
                "large_files",
                "scanning",
                items.len() as u32,
                total_bytes,
            );
        }

        let meta = match entry.metadata() {
            Ok(meta) => meta,
            Err(error) => {
                warnings.push(format!("无法读取 {}: {error}", path.display()));
                continue;
            }
        };

        let logical = logical_file_size(&meta);
        if logical <= min_bytes {
            continue;
        }

        let allocated = match file_size_on_disk_from_metadata(&meta) {
            Ok(size) => size,
            Err(error) => {
                warnings.push(format!("无法读取 {}: {error}", path.display()));
                continue;
            }
        };

        let logical_size_bytes = if is_sparse_file(&meta) {
            Some(logical)
        } else {
            None
        };

        let protected = is_protected_path(&path, home);
        let (safety_level, deletable) = if protected {
            (SafetyLevel::DisplayOnly, false)
        } else {
            (SafetyLevel::Review, true)
        };

        items.push(make_scan_item_full(
            "large_files",
            &path.to_path_buf(),
            allocated,
            logical_size_bytes,
            Some(file_category(&path)),
            safety_level,
            false,
            deletable,
            None,
        ));
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::Settings;
    use std::fs;
    use std::path::PathBuf;
    use tempfile::tempdir;

    const MIN_BYTES: u64 = 1024;

    fn ctx_for_home(home: PathBuf, include_node_modules: bool) -> ScanContext {
        ScanContext {
            home,
            settings: Settings {
                large_file_min_bytes: MIN_BYTES,
                include_node_modules,
                ..Settings::default()
            },
            cancel: None,
            on_progress: None,
        }
    }

    #[test]
    fn finds_large_files() {
        let home = tempdir().unwrap();
        let large = home.path().join("big.bin");
        fs::write(&large, vec![0u8; MIN_BYTES as usize + 1]).unwrap();

        let ctx = ctx_for_home(home.path().to_path_buf(), false);
        let result = LargeFilesScanner.scan(&ctx).expect("scan");

        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].file_category.as_deref(), Some(".bin"));
    }

    #[test]
    fn assigns_file_category() {
        let home = tempdir().unwrap();
        fs::write(
            home.path().join("movie.mp4"),
            vec![0u8; MIN_BYTES as usize + 1],
        )
        .unwrap();

        let ctx = ctx_for_home(home.path().to_path_buf(), false);
        let result = LargeFilesScanner.scan(&ctx).expect("scan");

        assert_eq!(result.items[0].file_category.as_deref(), Some("视频"));
    }

    #[test]
    fn skips_small_files() {
        let home = tempdir().unwrap();
        fs::write(home.path().join("small.bin"), b"tiny").unwrap();

        let ctx = ctx_for_home(home.path().to_path_buf(), false);
        let result = LargeFilesScanner.scan(&ctx).expect("scan");

        assert!(result.items.is_empty());
    }

    #[test]
    fn skips_git_directories() {
        let home = tempdir().unwrap();
        let git_dir = home.path().join("project/.git/objects");
        fs::create_dir_all(&git_dir).unwrap();
        fs::write(git_dir.join("large.pack"), vec![0u8; MIN_BYTES as usize + 1]).unwrap();

        let ctx = ctx_for_home(home.path().to_path_buf(), false);
        let result = LargeFilesScanner.scan(&ctx).expect("scan");

        assert!(result.items.is_empty());
    }

    #[test]
    fn marks_docker_paths_protected() {
        let home = tempdir().unwrap();
        let docker_dir = home
            .path()
            .join("Library/Containers/com.docker.docker/Data/vms/0/data");
        fs::create_dir_all(&docker_dir).unwrap();
        fs::write(
            docker_dir.join("Docker.raw"),
            vec![0u8; MIN_BYTES as usize + 1],
        )
        .unwrap();

        let ctx = ctx_for_home(home.path().to_path_buf(), false);
        let result = LargeFilesScanner.scan(&ctx).expect("scan");

        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].safety_level, SafetyLevel::DisplayOnly);
        assert!(!result.items[0].deletable);
        assert_eq!(result.items[0].file_category.as_deref(), Some("虚拟机磁盘"));
    }
}
