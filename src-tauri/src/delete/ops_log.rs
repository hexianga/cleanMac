use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

static LOG_PATH_OVERRIDE: Mutex<Option<PathBuf>> = Mutex::new(None);

/// Production log: `~/Library/Logs/磁盘助手/operations.log`
pub fn default_operations_log_path() -> Option<PathBuf> {
    dirs::home_dir().map(|home| {
        home.join("Library/Logs/磁盘助手/operations.log")
    })
}

fn resolve_log_path() -> Option<PathBuf> {
    if let Ok(guard) = LOG_PATH_OVERRIDE.lock() {
        if let Some(path) = guard.as_ref() {
            return Some(path.clone());
        }
    }
    default_operations_log_path()
}

/// Test hook: redirect log writes to a temp file.
#[cfg(test)]
pub fn set_log_path_for_tests(path: Option<PathBuf>) {
    let mut guard = LOG_PATH_OVERRIDE.lock().expect("log path lock");
    *guard = path;
}

/// Append one line: ISO8601 UTC timestamp, scanner_id, path, ok|error message (tab-separated).
pub fn log_operation(scanner_id: &str, path: &str, result: &Result<(), String>) {
    let Some(log_path) = resolve_log_path() else {
        return;
    };
    let _ = append_log_line(&log_path, scanner_id, path, result);
}

fn append_log_line(
    log_path: &Path,
    scanner_id: &str,
    path: &str,
    result: &Result<(), String>,
) -> std::io::Result<()> {
    if let Some(parent) = log_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let line = format_log_line(&utc_iso8601_now(), scanner_id, path, result);
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)?;
    writeln!(file, "{line}")?;
    Ok(())
}

pub fn format_log_line(
    timestamp: &str,
    scanner_id: &str,
    path: &str,
    result: &Result<(), String>,
) -> String {
    let status = match result {
        Ok(()) => "ok".into(),
        Err(message) => sanitize_log_field(message),
    };
    format!("{timestamp}\t{scanner_id}\t{path}\t{status}")
}

fn sanitize_log_field(value: &str) -> String {
    value
        .chars()
        .map(|c| if c == '\t' || c == '\n' || c == '\r' { ' ' } else { c })
        .collect()
}

fn utc_iso8601_now() -> String {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    utc_iso8601_from_unix(duration.as_secs())
}

/// `2026-05-31T12:00:00Z` from Unix seconds (UTC).
fn utc_iso8601_from_unix(secs: u64) -> String {
    let (year, month, day) = civil_from_days(secs / 86_400);
    let time = secs % 86_400;
    let hour = time / 3600;
    let minute = (time % 3600) / 60;
    let second = time % 60;
    format!(
        "{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z"
    )
}

/// Days since 1970-01-01 → (year, month, day). Howard Hinnant civil algorithm.
fn civil_from_days(days_since_epoch: u64) -> (u32, u32, u32) {
    let z = days_since_epoch + 719_468;
    let era = z / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = y + if m <= 2 { 1 } else { 0 };
    (year as u32, m as u32, d as u32)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn format_log_line_ok_and_err() {
        let ok = format_log_line(
            "2026-05-31T12:00:00Z",
            "dev_caches",
            "/Users/me/Library/Caches",
            &Ok(()),
        );
        assert_eq!(
            ok,
            "2026-05-31T12:00:00Z\tdev_caches\t/Users/me/Library/Caches\tok"
        );

        let err = format_log_line(
            "2026-05-31T12:00:00Z",
            "trash",
            "/Users/me/.Trash/x",
            &Err("permission\tdenied\n".into()),
        );
        assert_eq!(
            err,
            "2026-05-31T12:00:00Z\ttrash\t/Users/me/.Trash/x\tpermission denied "
        );
    }

    #[test]
    fn utc_iso8601_from_unix_epoch() {
        assert_eq!(utc_iso8601_from_unix(0), "1970-01-01T00:00:00Z");
        assert_eq!(utc_iso8601_from_unix(86_400), "1970-01-02T00:00:00Z");
        assert_eq!(utc_iso8601_from_unix(3_661), "1970-01-01T01:01:01Z");
    }

    #[test]
    fn appends_line_to_injected_log_path() {
        let dir = tempdir().unwrap();
        let log_path = dir.path().join("operations.log");
        set_log_path_for_tests(Some(log_path.clone()));

        log_operation("downloads", "/tmp/foo.dmg", &Ok(()));
        log_operation("logs", "/tmp/bar.log", &Err("read only".into()));

        set_log_path_for_tests(None);

        let contents = fs::read_to_string(&log_path).unwrap();
        let lines: Vec<&str> = contents.lines().collect();
        assert_eq!(lines.len(), 2);

        let parts: Vec<&str> = lines[0].split('\t').collect();
        assert_eq!(parts.len(), 4);
        assert!(parts[0].ends_with('Z'));
        assert_eq!(parts[1], "downloads");
        assert_eq!(parts[2], "/tmp/foo.dmg");
        assert_eq!(parts[3], "ok");

        assert!(lines[1].contains("\tlogs\t/tmp/bar.log\tread only"));
        assert!(log_path.parent().unwrap().is_dir());
    }
}
