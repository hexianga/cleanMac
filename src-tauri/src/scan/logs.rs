use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use crate::model::{make_scan_item, SafetyLevel, ScanCategoryResult, ScanContext, ScanItem};
use crate::scan::walk::is_denied;
use crate::scan::Scanner;

const LOG_MIN_BYTES: u64 = 1024 * 1024;
const LOG_AGE_THRESHOLD: Duration = Duration::from_secs(7 * 24 * 3600);

pub struct LogsScanner;

impl Scanner for LogsScanner {
    fn id(&self) -> &'static str {
        "logs"
    }

    fn name(&self) -> &'static str {
        "日志与诊断"
    }

    fn default_safety(&self) -> SafetyLevel {
        SafetyLevel::Safe
    }

    fn scan(&self, ctx: &ScanContext) -> Result<ScanCategoryResult, String> {
        let mut items = Vec::new();
        let mut warnings = Vec::new();
        let mut seen = HashSet::new();

        let logs_root = ctx.home.join("Library/Logs");
        if logs_root.is_dir() {
            collect_log_files(
                self.id(),
                &logs_root,
                &ctx.home,
                &mut seen,
                &mut items,
                &mut warnings,
            );
            collect_diagnostic_reports(
                self.id(),
                &logs_root.join("DiagnosticReports"),
                &ctx.home,
                &mut seen,
                &mut items,
                &mut warnings,
            );
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

fn collect_log_files(
    scanner_id: &str,
    dir: &Path,
    home: &Path,
    seen: &mut HashSet<PathBuf>,
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

        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(error) => {
                warnings.push(format!("无法读取 {}: {error}", path.display()));
                continue;
            }
        };

        if file_type.is_dir() {
            collect_log_files(scanner_id, &path, home, seen, items, warnings);
            continue;
        }

        if !file_type.is_file() || !is_log_file(&path) {
            continue;
        }

        let meta = match entry.metadata() {
            Ok(meta) => meta,
            Err(error) => {
                warnings.push(format!("无法读取 {}: {error}", path.display()));
                continue;
            }
        };

        if !qualifies_log_file(&meta) {
            continue;
        }

        add_file_item(scanner_id, &path, &meta, seen, items);
    }
}

fn collect_diagnostic_reports(
    scanner_id: &str,
    dir: &Path,
    home: &Path,
    seen: &mut HashSet<PathBuf>,
    items: &mut Vec<ScanItem>,
    warnings: &mut Vec<String>,
) {
    if !dir.is_dir() {
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

        let meta = match entry.metadata() {
            Ok(meta) => meta,
            Err(error) => {
                warnings.push(format!("无法读取 {}: {error}", path.display()));
                continue;
            }
        };

        if !meta.is_file() || !is_older_than(&meta, LOG_AGE_THRESHOLD) {
            continue;
        }

        add_file_item(scanner_id, &path, &meta, seen, items);
    }
}

fn add_file_item(
    scanner_id: &str,
    path: &Path,
    meta: &fs::Metadata,
    seen: &mut HashSet<PathBuf>,
    items: &mut Vec<ScanItem>,
) {
    if !seen.insert(path.to_path_buf()) {
        return;
    }

    items.push(make_scan_item(
        scanner_id,
        &path.to_path_buf(),
        meta.len(),
        SafetyLevel::Safe,
        true,
        true,
    ));
}

fn is_log_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("log"))
        .unwrap_or(false)
}

fn qualifies_log_file(meta: &fs::Metadata) -> bool {
    meta.len() > LOG_MIN_BYTES || is_older_than(meta, LOG_AGE_THRESHOLD)
}

fn is_older_than(meta: &fs::Metadata, threshold: Duration) -> bool {
    let modified = match meta.modified() {
        Ok(modified) => modified,
        Err(_) => return false,
    };

    SystemTime::now()
        .duration_since(modified)
        .is_ok_and(|elapsed| elapsed > threshold)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[cfg(unix)]
    fn set_mtime(path: &Path, modified: SystemTime) {
        use std::ffi::CString;
        use std::os::unix::ffi::OsStrExt;
        use std::time::UNIX_EPOCH;

        let duration = modified.duration_since(UNIX_EPOCH).unwrap();
        let times = libc::timespec {
            tv_sec: duration.as_secs() as libc::time_t,
            tv_nsec: duration.subsec_nanos() as libc::c_long,
        };
        let c_path = CString::new(path.as_os_str().as_bytes()).unwrap();
        unsafe {
            let mut arr = [times, times];
            libc::utimensat(libc::AT_FDCWD, c_path.as_ptr(), arr.as_mut_ptr(), 0);
        }
    }

    #[test]
    fn finds_large_log_files() {
        let home = tempdir().unwrap();
        let logs = home.path().join("Library/Logs/App");
        fs::create_dir_all(&logs).unwrap();
        let large_log = logs.join("app.log");
        fs::write(&large_log, vec![0u8; LOG_MIN_BYTES as usize + 1]).unwrap();

        let ctx = ScanContext::with_home(home.path().to_path_buf());
        let result = LogsScanner.scan(&ctx).expect("scan");

        assert_eq!(result.scanner_id, "logs");
        assert!(result.items.iter().any(|item| item.path.ends_with("app.log")));
        assert!(result.items.iter().all(|item| item.selected_by_default));
        assert!(result.items.iter().all(|item| item.safety_level == SafetyLevel::Safe));
    }

    #[test]
    fn skips_small_recent_logs() {
        let home = tempdir().unwrap();
        let logs = home.path().join("Library/Logs/App");
        fs::create_dir_all(&logs).unwrap();
        fs::write(logs.join("recent.log"), b"tiny").unwrap();

        let ctx = ScanContext::with_home(home.path().to_path_buf());
        let result = LogsScanner.scan(&ctx).expect("scan");

        assert!(result.items.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn finds_old_diagnostic_reports() {
        let home = tempdir().unwrap();
        let reports = home.path().join("Library/Logs/DiagnosticReports");
        fs::create_dir_all(&reports).unwrap();
        let report = reports.join("MyApp-2026-01-01-120000.ips");
        fs::write(&report, b"crash report").unwrap();
        set_mtime(
            &report,
            SystemTime::now() - LOG_AGE_THRESHOLD - Duration::from_secs(3600),
        );

        let ctx = ScanContext::with_home(home.path().to_path_buf());
        let result = LogsScanner.scan(&ctx).expect("scan");

        assert_eq!(result.items.len(), 1);
        assert!(result.items[0].path.ends_with("MyApp-2026-01-01-120000.ips"));
    }

    #[cfg(unix)]
    #[test]
    fn finds_old_small_log_files() {
        let home = tempdir().unwrap();
        let logs = home.path().join("Library/Logs/App");
        fs::create_dir_all(&logs).unwrap();
        let old_log = logs.join("old.log");
        fs::write(&old_log, b"small but old").unwrap();
        set_mtime(
            &old_log,
            SystemTime::now() - LOG_AGE_THRESHOLD - Duration::from_secs(3600),
        );

        let ctx = ScanContext::with_home(home.path().to_path_buf());
        let result = LogsScanner.scan(&ctx).expect("scan");

        assert_eq!(result.items.len(), 1);
        assert!(result.items[0].path.ends_with("old.log"));
    }
}
