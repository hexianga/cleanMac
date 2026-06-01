use std::fs;
use std::path::PathBuf;

pub const PRODUCT_NAME: &str = "CleanMac";
pub const LEGACY_APP_NAME: &str = "磁盘助手";
const SETTINGS_FILE: &str = "settings.json";
const OPERATIONS_LOG_FILE: &str = "operations.log";

pub fn settings_path() -> Result<PathBuf, String> {
    let data_dir = dirs::data_dir().ok_or_else(|| "无法定位 Application Support".to_string())?;
    Ok(data_dir.join(PRODUCT_NAME).join(SETTINGS_FILE))
}

pub fn operations_log_path() -> Option<PathBuf> {
    dirs::home_dir().map(|home| {
        home.join("Library/Logs")
            .join(PRODUCT_NAME)
            .join(OPERATIONS_LOG_FILE)
    })
}

fn legacy_settings_path() -> Option<PathBuf> {
    dirs::data_dir().map(|data_dir| {
        data_dir.join(LEGACY_APP_NAME).join(SETTINGS_FILE)
    })
}

fn legacy_operations_log_path() -> Option<PathBuf> {
    dirs::home_dir().map(|home| {
        home.join("Library/Logs")
            .join(LEGACY_APP_NAME)
            .join(OPERATIONS_LOG_FILE)
    })
}

fn copy_if_legacy_only(new_path: &PathBuf, legacy_path: &PathBuf) {
    if new_path.exists() || !legacy_path.exists() {
        return;
    }
    if let Some(parent) = new_path.parent() {
        if let Err(error) = fs::create_dir_all(parent) {
            eprintln!("CleanMac migration: create dir failed: {error}");
            return;
        }
    }
    if let Err(error) = fs::copy(legacy_path, new_path) {
        eprintln!("CleanMac migration: copy {:?} -> {:?}: {error}", legacy_path, new_path);
    }
}

/// One-time copy of settings and operation logs from 磁盘助手 paths.
pub fn migrate_legacy_data() {
    if let (Ok(new_path), Some(legacy_path)) = (settings_path(), legacy_settings_path()) {
        copy_if_legacy_only(&new_path, &legacy_path);
    }

    if let (Some(new_path), Some(legacy_path)) = (operations_log_path(), legacy_operations_log_path())
    {
        copy_if_legacy_only(&new_path, &legacy_path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_home::with_home;
    use std::fs;

    #[test]
    fn migrates_settings_when_only_legacy_exists() {
        let temp = tempfile::tempdir().unwrap();
        with_home(temp.path(), || {
            let legacy = legacy_settings_path().unwrap();
            fs::create_dir_all(legacy.parent().unwrap()).unwrap();
            fs::write(&legacy, r#"{"largeFileMinBytes":999}"#).unwrap();

            migrate_legacy_data();

            let new_path = settings_path().unwrap();
            assert!(new_path.exists());
            assert_eq!(fs::read_to_string(&new_path).unwrap(), r#"{"largeFileMinBytes":999}"#);
        });
    }

    #[test]
    fn skips_settings_migration_when_new_exists() {
        let temp = tempfile::tempdir().unwrap();
        with_home(temp.path(), || {
            let legacy = legacy_settings_path().unwrap();
            fs::create_dir_all(legacy.parent().unwrap()).unwrap();
            fs::write(&legacy, "legacy").unwrap();

            let new_path = settings_path().unwrap();
            fs::create_dir_all(new_path.parent().unwrap()).unwrap();
            fs::write(&new_path, "current").unwrap();

            migrate_legacy_data();

            assert_eq!(fs::read_to_string(&new_path).unwrap(), "current");
        });
    }

    #[test]
    fn migrates_operations_log_when_only_legacy_exists() {
        let temp = tempfile::tempdir().unwrap();
        with_home(temp.path(), || {
            let legacy = legacy_operations_log_path().unwrap();
            fs::create_dir_all(legacy.parent().unwrap()).unwrap();
            fs::write(&legacy, "log-line").unwrap();

            migrate_legacy_data();

            let new_path = operations_log_path().unwrap();
            assert!(new_path.exists());
            assert_eq!(fs::read_to_string(&new_path).unwrap(), "log-line");
        });
    }
}
