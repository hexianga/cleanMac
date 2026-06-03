use std::fs;
use std::path::{Path, PathBuf};

use crate::model::ScanCategoryResult;

const MISSING_CACHE_MSG: &str =
    "未找到调试缓存。请在仓库根目录执行：pnpm dev:cache-videos 或 pnpm dev:cache-images";
const INVALID_CACHE_MSG: &str =
    "调试缓存损坏，请重新执行 pnpm dev:cache-videos 或 pnpm dev:cache-images";

pub fn dev_cache_dir() -> Result<PathBuf, String> {
    if let Ok(dir) = std::env::var("CLEANMAC_DEV_CACHE_DIR") {
        return Ok(PathBuf::from(dir));
    }

    let start = std::env::current_dir().map_err(|e| e.to_string())?;
    let mut dir = start.clone();

    for _ in 0..8 {
        let cache_dir = dir.join(".dev-cache");
        if cache_dir.is_dir() {
            return Ok(cache_dir);
        }
        if is_cleanmac_repo_root(&dir) {
            return Ok(cache_dir);
        }
        if !dir.pop() {
            break;
        }
    }

    Ok(start.join(".dev-cache"))
}

fn is_cleanmac_repo_root(dir: &Path) -> bool {
    let package_json = dir.join("package.json");
    if !package_json.is_file() {
        return false;
    }
    let content = match fs::read_to_string(&package_json) {
        Ok(content) => content,
        Err(_) => return false,
    };
    content.contains("dev:cache-videos") || content.contains("dev:cache-images")
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
        return Err(MISSING_CACHE_MSG.into());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|_| INVALID_CACHE_MSG.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{SafetyLevel, ScanCategoryResult};
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn write_and_read_round_trip() {
        let dir = tempdir().unwrap();
        let cache_home = dir.path().join("cache-root");
        fs::create_dir_all(&cache_home).unwrap();
        std::env::set_var("CLEANMAC_DEV_CACHE_DIR", &cache_home);

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

    #[test]
    fn finds_cache_when_cwd_is_src_tauri() {
        let repo = tempdir().unwrap();
        fs::write(
            repo.path().join("package.json"),
            r#"{"scripts":{"dev:cache-images":"x"}}"#,
        )
        .unwrap();

        let category = ScanCategoryResult {
            scanner_id: "file_image".into(),
            name: "图片".into(),
            safety_level: SafetyLevel::Review,
            items: Vec::new(),
            total_bytes: 0,
            warnings: Vec::new(),
        };

        std::env::remove_var("CLEANMAC_DEV_CACHE_DIR");
        let prev = std::env::current_dir().ok();
        std::env::set_current_dir(repo.path()).unwrap();
        write_dev_cache("file_image", &category).expect("write at repo root");

        let sub = repo.path().join("src-tauri");
        fs::create_dir_all(&sub).unwrap();
        std::env::set_current_dir(&sub).unwrap();

        let resolved = dev_cache_dir().expect("dir").canonicalize().expect("canon");
        let expected = repo.path().join(".dev-cache").canonicalize().expect("canon");
        assert_eq!(resolved, expected);
        assert!(dev_cache_exists("file_image").unwrap());

        if let Some(p) = prev {
            let _ = std::env::set_current_dir(p);
        }
        std::env::remove_var("CLEANMAC_DEV_CACHE_DIR");
    }
}
