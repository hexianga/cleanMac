use std::fs;
use std::path::PathBuf;

use crate::app_identity;
use serde::{Deserialize, Serialize};

fn default_large_file_min_bytes() -> u64 {
    104_857_600
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
    #[serde(default)]
    pub include_node_modules: bool,
    #[serde(default = "default_one_click_scan_ids")]
    pub one_click_scan_ids: Vec<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            large_file_min_bytes: default_large_file_min_bytes(),
            include_node_modules: false,
            one_click_scan_ids: default_one_click_scan_ids(),
        }
    }
}

pub fn settings_path() -> Result<PathBuf, String> {
    app_identity::settings_path()
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

    let mut settings: Settings = serde_json::from_str(&content).unwrap_or_default();
    settings
        .one_click_scan_ids
        .retain(|id| id != "duplicates");
    settings
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
    use crate::test_home::with_home;

    #[test]
    fn default_settings_values() {
        let settings = Settings::default();
        assert_eq!(settings.large_file_min_bytes, 104_857_600);
        assert!(!settings.include_node_modules);
    }

    #[test]
    fn default_one_click_scan_ids_excludes_slow_scanners() {
        let settings = Settings::default();
        assert!(settings.one_click_scan_ids.contains(&"downloads".to_string()));
        assert!(!settings.one_click_scan_ids.contains(&"large_files".to_string()));
        assert!(!settings.one_click_scan_ids.contains(&"applications".to_string()));
    }

    #[test]
    fn load_strips_duplicates_from_one_click_ids() {
        let json = r#"{"oneClickScanIds":["downloads","duplicates","trash"]}"#;
        let mut settings: Settings = serde_json::from_str(json).unwrap();
        settings.one_click_scan_ids.retain(|id| id != "duplicates");
        assert!(!settings.one_click_scan_ids.contains(&"duplicates".to_string()));
        assert_eq!(settings.one_click_scan_ids.len(), 2);
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
            include_node_modules: true,
            ..Settings::default()
        };
        let json = serde_json::to_string(&settings).unwrap();
        let parsed: Settings = serde_json::from_str(&json).unwrap();
        assert_eq!(settings, parsed);
    }

    #[test]
    fn load_save_round_trip() {
        let temp = tempfile::tempdir().unwrap();
        with_home(temp.path(), || {
            let settings = Settings {
                large_file_min_bytes: 200_000_000,
                include_node_modules: true,
                ..Settings::default()
            };
            save_settings(&settings).expect("save");
            let loaded = load_settings();
            assert_eq!(loaded, settings);
        });
    }
}
