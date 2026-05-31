use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

const APP_NAME: &str = "磁盘助手";
const SETTINGS_FILE: &str = "settings.json";

fn default_large_file_min_bytes() -> u64 {
    104_857_600
}

fn default_duplicate_min_bytes() -> u64 {
    1_048_576
}

fn default_one_click_scan_ids() -> Vec<String> {
    vec![
        "downloads".into(),
        "app_caches".into(),
        "dev_caches".into(),
        "logs".into(),
        "trash".into(),
    ]
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default = "default_large_file_min_bytes")]
    pub large_file_min_bytes: u64,
    #[serde(default = "default_duplicate_min_bytes")]
    pub duplicate_min_bytes: u64,
    #[serde(default)]
    pub include_node_modules: bool,
    #[serde(default)]
    pub scan_duplicates: bool,
    #[serde(default = "default_max_hash_bytes")]
    pub max_hash_bytes: u64,
    #[serde(default = "default_one_click_scan_ids")]
    pub one_click_scan_ids: Vec<String>,
}

fn default_max_hash_bytes() -> u64 {
    536_870_912 // 512 MB
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            large_file_min_bytes: default_large_file_min_bytes(),
            duplicate_min_bytes: default_duplicate_min_bytes(),
            include_node_modules: false,
            scan_duplicates: false,
            max_hash_bytes: default_max_hash_bytes(),
            one_click_scan_ids: default_one_click_scan_ids(),
        }
    }
}

pub fn settings_path() -> Result<PathBuf, String> {
    let data_dir = dirs::data_dir().ok_or_else(|| "无法定位 Application Support".to_string())?;
    Ok(data_dir.join(APP_NAME).join(SETTINGS_FILE))
}

pub fn load_settings() -> Settings {
    let path = match settings_path() {
        Ok(path) => path,
        Err(_) => return Settings::default(),
    };

    let content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(_) => return Settings::default(),
    };

    serde_json::from_str(&content).unwrap_or_default()
}

pub fn save_settings(settings: &Settings) -> Result<(), String> {
    let path = settings_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn default_settings_values() {
        let settings = Settings::default();
        assert_eq!(settings.large_file_min_bytes, 104_857_600);
        assert_eq!(settings.duplicate_min_bytes, 1_048_576);
        assert!(!settings.include_node_modules);
        assert!(!settings.scan_duplicates);
    }

    #[test]
    fn default_one_click_scan_ids_excludes_slow_scanners() {
        let settings = Settings::default();
        assert!(settings.one_click_scan_ids.contains(&"downloads".to_string()));
        assert!(!settings.one_click_scan_ids.contains(&"large_files".to_string()));
        assert!(!settings.one_click_scan_ids.contains(&"duplicates".to_string()));
    }

    #[test]
    fn one_click_scan_ids_round_trip_json() {
        let settings = Settings {
            one_click_scan_ids: vec!["large_files".into()],
            ..Settings::default()
        };
        let json = serde_json::to_string(&settings).unwrap();
        let parsed: Settings = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.one_click_scan_ids, vec!["large_files"]);
    }

    #[test]
    fn round_trip_json() {
        let settings = Settings {
            large_file_min_bytes: 50_000_000,
            duplicate_min_bytes: 2_000_000,
            include_node_modules: true,
            scan_duplicates: true,
            max_hash_bytes: 512 * 1024 * 1024,
            ..Settings::default()
        };
        let json = serde_json::to_string(&settings).unwrap();
        let parsed: Settings = serde_json::from_str(&json).unwrap();
        assert_eq!(settings, parsed);
    }

    #[test]
    fn load_save_round_trip() {
        let temp = tempfile::tempdir().unwrap();
        let prev_home = env::var("HOME").ok();
        env::set_var("HOME", temp.path());

        let settings = Settings {
            large_file_min_bytes: 200_000_000,
            duplicate_min_bytes: 512_000,
            include_node_modules: true,
            scan_duplicates: false,
            max_hash_bytes: 512 * 1024 * 1024,
            ..Settings::default()
        };
        save_settings(&settings).expect("save");
        let loaded = load_settings();
        assert_eq!(loaded, settings);

        if let Some(home) = prev_home {
            env::set_var("HOME", home);
        } else {
            env::remove_var("HOME");
        }
    }
}
