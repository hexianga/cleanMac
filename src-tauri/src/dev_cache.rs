use std::fs;
use std::path::PathBuf;

use crate::model::ScanCategoryResult;

pub fn dev_cache_dir() -> Result<PathBuf, String> {
    if let Ok(dir) = std::env::var("CLEANMAC_DEV_CACHE_DIR") {
        return Ok(PathBuf::from(dir));
    }
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    Ok(cwd.join(".dev-cache"))
}

pub fn dev_cache_path(scanner_id: &str) -> Result<PathBuf, String> {
    Ok(dev_cache_dir()?.join(format!("{scanner_id}.json")))
}

pub fn dev_cache_exists(scanner_id: &str) -> Result<bool, String> {
    Ok(dev_cache_path(scanner_id)?.is_file())
}

pub fn write_dev_cache(scanner_id: &str, category: &ScanCategoryResult) -> Result<PathBuf, String> {
    let path = dev_cache_path(scanner_id)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(category).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(path)
}

pub fn read_dev_cache(scanner_id: &str) -> Result<ScanCategoryResult, String> {
    let path = dev_cache_path(scanner_id)?;
    if !path.is_file() {
        return Err(format!("调试缓存不存在: {}", path.display()));
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| format!("调试缓存 JSON 无效: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{SafetyLevel, ScanCategoryResult};
    use tempfile::tempdir;

    #[test]
    fn write_and_read_round_trip() {
        let dir = tempdir().unwrap();
        std::env::set_var("CLEANMAC_DEV_CACHE_DIR", dir.path());

        let category = ScanCategoryResult {
            scanner_id: "file_image".into(),
            name: "图片".into(),
            safety_level: SafetyLevel::Review,
            items: Vec::new(),
            total_bytes: 0,
            warnings: Vec::new(),
        };

        write_dev_cache("file_image", &category).expect("write");
        assert!(dev_cache_exists("file_image").unwrap());
        let loaded = read_dev_cache("file_image").expect("read");
        assert_eq!(loaded.scanner_id, "file_image");

        std::env::remove_var("CLEANMAC_DEV_CACHE_DIR");
    }
}
