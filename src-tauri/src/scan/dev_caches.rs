use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, SystemTime};

use crate::model::{emit_scan_progress, make_scan_item, SafetyLevel, ScanCategoryResult, ScanContext, ScanItem};
use crate::scan::walk::{dir_size, is_denied};
use crate::scan::Scanner;

const DERIVED_DATA_RECENT: Duration = Duration::from_secs(60);
const CARGO_TARGET_MIN_BYTES: u64 = 100 * 1024 * 1024;
const HOME_NODE_MODULES_MAX_DEPTH: u32 = 5;
const PROJECT_ROOT_MAX_DEPTH: u32 = 8;
const CARGO_WALK_MAX_DEPTH: u32 = 8;

pub struct DevCachesScanner;

impl Scanner for DevCachesScanner {
    fn id(&self) -> &'static str {
        "dev_caches"
    }

    fn name(&self) -> &'static str {
        "开发缓存"
    }

    fn default_safety(&self) -> SafetyLevel {
        SafetyLevel::Safe
    }

    fn scan(&self, ctx: &ScanContext) -> Result<ScanCategoryResult, String> {
        let mut items = Vec::new();
        let mut warnings = Vec::new();

        scan_derived_data(ctx, &mut items, &mut warnings);
        emit_scan_progress(ctx, "dev_caches", "scanning", items.len() as u32, sum_bytes(&items));
        scan_shutdown_simulators(ctx, &mut items, &mut warnings);
        emit_scan_progress(ctx, "dev_caches", "scanning", items.len() as u32, sum_bytes(&items));
        scan_simple_cache_dirs(ctx, &mut items, &mut warnings);
        emit_scan_progress(ctx, "dev_caches", "scanning", items.len() as u32, sum_bytes(&items));
        scan_cargo_release_targets(ctx, &mut items, &mut warnings);
        emit_scan_progress(ctx, "dev_caches", "scanning", items.len() as u32, sum_bytes(&items));
        scan_node_modules(ctx, &mut items, &mut warnings);
        emit_scan_progress(ctx, "dev_caches", "scanning", items.len() as u32, sum_bytes(&items));

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

fn sum_bytes(items: &[ScanItem]) -> u64 {
    items.iter().map(|item| item.size_bytes).sum()
}

/// Static deletable cache paths relative to home (used by scan + tests).
pub fn dev_cache_candidate_paths(home: &Path) -> Vec<PathBuf> {
    vec![
        home.join("Library/Developer/Xcode/DerivedData"),
        home.join(".npm"),
        home.join("Library/Caches/Yarn"),
        home.join("Library/Caches/CocoaPods"),
    ]
}

fn scan_derived_data(
    ctx: &ScanContext,
    items: &mut Vec<ScanItem>,
    warnings: &mut Vec<String>,
) {
    let path = ctx.home.join("Library/Developer/Xcode/DerivedData");
    add_dir_if_exists(
        "dev_caches",
        &path,
        items,
        warnings,
        SafetyLevel::Safe,
        true,
        !is_recently_modified(&path, DERIVED_DATA_RECENT),
        None,
    );
}

fn scan_simple_cache_dirs(
    ctx: &ScanContext,
    items: &mut Vec<ScanItem>,
    warnings: &mut Vec<String>,
) {
    for path in dev_cache_candidate_paths(&ctx.home) {
        if path.ends_with("DerivedData") {
            continue;
        }
        add_dir_if_exists(
            "dev_caches",
            &path,
            items,
            warnings,
            SafetyLevel::Safe,
            true,
            true,
            None,
        );
    }
}

fn scan_shutdown_simulators(
    ctx: &ScanContext,
    items: &mut Vec<ScanItem>,
    warnings: &mut Vec<String>,
) {
    let devices_root = ctx
        .home
        .join("Library/Developer/CoreSimulator/Devices");
    if !devices_root.is_dir() {
        return;
    }

    for uuid in shutdown_simulator_uuids() {
        let path = devices_root.join(&uuid);
        if !path.is_dir() {
            continue;
        }
        add_dir_if_exists(
            "dev_caches",
            &path,
            items,
            warnings,
            SafetyLevel::Safe,
            true,
            true,
            None,
        );
    }
}

fn shutdown_simulator_uuids() -> Vec<String> {
    let output = match Command::new("xcrun")
        .args(["simctl", "list", "devices"])
        .output()
    {
        Ok(output) if output.status.success() => output,
        _ => return Vec::new(),
    };

    let text = String::from_utf8_lossy(&output.stdout);
    text.lines()
        .filter(|line| line.contains("(Shutdown)"))
        .filter_map(|line| find_uuid(line))
        .collect()
}

fn find_uuid(line: &str) -> Option<String> {
    for start in 0..line.len().saturating_sub(35) {
        let candidate = &line[start..start + 36];
        if looks_like_uuid(candidate) {
            return Some(candidate.to_string());
        }
    }
    None
}

fn looks_like_uuid(value: &str) -> bool {
    value.len() == 36
        && value
            .chars()
            .enumerate()
            .all(|(index, ch)| match index {
                8 | 13 | 18 | 23 => ch == '-',
                _ => ch.is_ascii_hexdigit(),
            })
}

fn scan_cargo_release_targets(
    ctx: &ScanContext,
    items: &mut Vec<ScanItem>,
    warnings: &mut Vec<String>,
) {
    let mut seen = HashSet::new();
    walk_cargo_release_dirs(
        &ctx.home,
        0,
        CARGO_WALK_MAX_DEPTH,
        &ctx.home,
        &mut seen,
        items,
        warnings,
    );
}

fn walk_cargo_release_dirs(
    dir: &Path,
    depth: u32,
    max_depth: u32,
    home: &Path,
    seen: &mut HashSet<PathBuf>,
    items: &mut Vec<ScanItem>,
    warnings: &mut Vec<String>,
) {
    if depth > max_depth || is_denied(dir, home) {
        return;
    }

    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if is_denied(&path, home) {
            continue;
        }

        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) => continue,
        };

        if !file_type.is_dir() {
            continue;
        }

        if path.file_name().is_some_and(|name| name == "release")
            && path.parent().is_some_and(|parent| parent.file_name().is_some_and(|name| name == "target"))
        {
            if seen.insert(path.clone()) {
                add_dir_if_exists(
                    "dev_caches",
                    &path,
                    items,
                    warnings,
                    SafetyLevel::Safe,
                    true,
                    true,
                    Some(CARGO_TARGET_MIN_BYTES),
                );
            }
            continue;
        }

        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if name == "node_modules" || name == ".git" {
            continue;
        }

        walk_cargo_release_dirs(&path, depth + 1, max_depth, home, seen, items, warnings);
    }
}

fn scan_node_modules(
    ctx: &ScanContext,
    items: &mut Vec<ScanItem>,
    warnings: &mut Vec<String>,
) {
    let mut seen = HashSet::new();
    let project_roots = ["workspace", "projects"];

    for root_name in project_roots {
        let root = ctx.home.join(root_name);
        if root.is_dir() {
            walk_node_modules_dirs(
                &root,
                0,
                PROJECT_ROOT_MAX_DEPTH,
                &ctx.home,
                &mut seen,
                items,
                warnings,
            );
        }
    }

    walk_node_modules_dirs(
        &ctx.home,
        0,
        HOME_NODE_MODULES_MAX_DEPTH,
        &ctx.home,
        &mut seen,
        items,
        warnings,
    );
}

fn walk_node_modules_dirs(
    dir: &Path,
    depth: u32,
    max_depth: u32,
    home: &Path,
    seen: &mut HashSet<PathBuf>,
    items: &mut Vec<ScanItem>,
    warnings: &mut Vec<String>,
) {
    if depth > max_depth || is_denied(dir, home) {
        return;
    }

    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if is_denied(&path, home) {
            continue;
        }

        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) => continue,
        };

        if !file_type.is_dir() {
            continue;
        }

        if path.file_name().is_some_and(|name| name == "node_modules") {
            if seen.insert(path.clone()) {
                add_dir_if_exists(
                    "dev_caches",
                    &path,
                    items,
                    warnings,
                    SafetyLevel::DisplayOnly,
                    false,
                    false,
                    None,
                );
            }
            continue;
        }

        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if name == ".git" {
            continue;
        }

        walk_node_modules_dirs(&path, depth + 1, max_depth, home, seen, items, warnings);
    }
}

fn add_dir_if_exists(
    scanner_id: &str,
    path: &Path,
    items: &mut Vec<ScanItem>,
    warnings: &mut Vec<String>,
    safety_level: SafetyLevel,
    selected_by_default: bool,
    deletable: bool,
    min_bytes: Option<u64>,
) {
    if !path.is_dir() {
        return;
    }

    let size_bytes = match dir_size(path) {
        Ok(size) => size,
        Err(error) => {
            warnings.push(format!("无法统计 {}: {error}", path.display()));
            return;
        }
    };

    if size_bytes == 0 {
        return;
    }

    if let Some(min) = min_bytes {
        if size_bytes < min {
            return;
        }
    }

    items.push(make_scan_item(
        scanner_id,
        &path.to_path_buf(),
        size_bytes,
        safety_level,
        selected_by_default,
        deletable,
    ));
}

fn is_recently_modified(path: &Path, threshold: Duration) -> bool {
    let meta = match fs::metadata(path) {
        Ok(meta) => meta,
        Err(_) => return false,
    };

    let modified = match meta.modified() {
        Ok(modified) => modified,
        Err(_) => return false,
    };

    SystemTime::now()
        .duration_since(modified)
        .is_ok_and(|elapsed| elapsed < threshold)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn includes_core_dev_paths() {
        let home = tempdir().unwrap();
        let paths = dev_cache_candidate_paths(home.path());
        assert!(paths.iter().any(|p| p.ends_with("DerivedData")));
        assert!(paths.iter().any(|p| p.ends_with(".npm")));
    }

    #[test]
    fn scans_fixture_cache_dirs() {
        let home = tempdir().unwrap();
        let npm = home.path().join(".npm");
        fs::create_dir_all(&npm).unwrap();
        fs::write(npm.join("cache.tgz"), vec![0u8; 1024]).unwrap();

        let ctx = ScanContext::with_home(home.path().to_path_buf());
        let result = DevCachesScanner.scan(&ctx).expect("scan");

        assert!(result.items.iter().any(|item| item.path.ends_with(".npm")));
        assert!(result.items.iter().all(|item| item.scanner_id == "dev_caches"));
    }

    #[test]
    fn marks_recent_derived_data_non_deletable() {
        let home = tempdir().unwrap();
        let derived = home
            .path()
            .join("Library/Developer/Xcode/DerivedData");
        fs::create_dir_all(&derived).unwrap();
        fs::write(derived.join("Build"), b"fresh").unwrap();

        let ctx = ScanContext::with_home(home.path().to_path_buf());
        let result = DevCachesScanner.scan(&ctx).expect("scan");

        let item = result
            .items
            .iter()
            .find(|item| item.path.ends_with("DerivedData"))
            .expect("DerivedData item");
        assert!(!item.deletable);
    }

    #[test]
    fn node_modules_are_display_only() {
        let home = tempdir().unwrap();
        let nm = home.path().join("workspace/app/node_modules");
        fs::create_dir_all(&nm).unwrap();
        fs::write(nm.join("package.json"), b"{}").unwrap();

        let ctx = ScanContext::with_home(home.path().to_path_buf());
        let result = DevCachesScanner.scan(&ctx).expect("scan");

        let item = result
            .items
            .iter()
            .find(|item| item.path.ends_with("node_modules"))
            .expect("node_modules item");
        assert_eq!(item.safety_level, SafetyLevel::DisplayOnly);
        assert!(!item.deletable);
        assert!(!item.selected_by_default);
    }
}
