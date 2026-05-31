use std::fs;
use std::path::{Path, PathBuf};

#[cfg(unix)]
use std::os::unix::fs::MetadataExt;

/// Returns true if `path` is under a globally denied location relative to `home`.
pub fn is_denied(path: &Path, home: &Path) -> bool {
    denied_prefixes(home)
        .iter()
        .any(|prefix| path.starts_with(prefix))
}

/// Paths that may be listed but must not be deleted (VM disks, Docker data, etc.).
pub fn is_protected_path(path: &Path, home: &Path) -> bool {
    if is_denied(path, home) {
        return true;
    }

    let protected_prefixes = protected_prefixes(home);
    if protected_prefixes
        .iter()
        .any(|prefix| path.starts_with(prefix))
    {
        return true;
    }

    let ext = path
        .extension()
        .and_then(|name| name.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if ext == "raw" {
        let path_str = path.to_string_lossy().to_ascii_lowercase();
        if path_str.contains("docker")
            || path_str.contains("parallels")
            || path_str.contains("vmware")
            || path_str.contains("/vms/")
        {
            return true;
        }
    }

    false
}

/// Actual bytes allocated on disk (handles sparse files on macOS).
pub fn file_size_on_disk(path: &Path) -> Result<u64, String> {
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    file_size_on_disk_from_metadata(&meta)
}

pub fn file_size_on_disk_from_metadata(meta: &fs::Metadata) -> Result<u64, String> {
    #[cfg(target_os = "macos")]
    {
        #[cfg(unix)]
        {
            let blocks = meta.blocks();
            if blocks > 0 {
                return Ok(blocks * 512);
            }
        }
    }

    Ok(meta.len())
}

pub fn logical_file_size(meta: &fs::Metadata) -> u64 {
    meta.len()
}

pub fn is_sparse_file(meta: &fs::Metadata) -> bool {
    let logical = logical_file_size(meta);
    match file_size_on_disk_from_metadata(meta) {
        Ok(allocated) => logical.saturating_sub(allocated) > logical / 10 && logical > allocated,
        Err(_) => false,
    }
}

pub fn file_category(path: &Path) -> String {
    let ext = path
        .extension()
        .and_then(|name| name.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    match ext.as_str() {
        "mp4" | "mov" | "mkv" | "avi" | "wmv" | "m4v" | "webm" => "视频".into(),
        "dmg" | "iso" | "img" => "安装镜像".into(),
        "raw" | "vmdk" | "vhd" | "vdi" | "qcow2" => "虚拟机磁盘".into(),
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" | "tgz" => "压缩包".into(),
        "pkg" => "安装包".into(),
        "app" => "应用程序".into(),
        "db" | "sqlite" | "sqlite3" => "数据库".into(),
        "log" => "日志".into(),
        "pdf" => "文档".into(),
        "doc" | "docx" | "ppt" | "pptx" | "xls" | "xlsx" => "办公文档".into(),
        "" => "无扩展名".into(),
        other => format!(".{other}"),
    }
}

fn protected_prefixes(home: &Path) -> Vec<PathBuf> {
    vec![
        home.join("Library/Containers/com.docker.docker"),
        home.join("Library/Group Containers/group.com.docker"),
    ]
}

pub fn dir_size(path: &Path) -> Result<u64, String> {
    let meta = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    if meta.is_file() {
        return Ok(meta.len());
    }
    if !meta.is_dir() {
        return Ok(0);
    }

    let mut total = 0u64;
    for entry in fs::read_dir(path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        if entry_path.is_dir() {
            total += dir_size(&entry_path)?;
        } else if entry_path.is_file() {
            total += entry.metadata().map_err(|e| e.to_string())?.len();
        }
    }
    Ok(total)
}

fn denied_prefixes(home: &Path) -> Vec<PathBuf> {
    vec![
        home.join(".ssh"),
        home.join("Library/Keychains"),
        home.join("Library/Application Support/MobileSync/Backup"),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn skips_denylisted_paths() {
        let home = tempdir().unwrap();
        let ssh = home.path().join(".ssh");
        fs::create_dir_all(&ssh).unwrap();
        assert!(is_denied(&ssh, home.path()));
    }

    #[test]
    fn denies_ssh_subpaths() {
        let home = tempdir().unwrap();
        let key = home.path().join(".ssh/id_rsa");
        fs::create_dir_all(key.parent().unwrap()).unwrap();
        fs::write(&key, b"secret").unwrap();
        assert!(is_denied(&key, home.path()));
    }

    #[test]
    fn denies_keychains() {
        let home = tempdir().unwrap();
        let keychains = home.path().join("Library/Keychains");
        fs::create_dir_all(&keychains).unwrap();
        assert!(is_denied(&keychains, home.path()));
        assert!(is_denied(
            &keychains.join("login.keychain-db"),
            home.path()
        ));
    }

    #[test]
    fn denies_mobile_sync_backup() {
        let home = tempdir().unwrap();
        let backup = home
            .path()
            .join("Library/Application Support/MobileSync/Backup");
        fs::create_dir_all(&backup).unwrap();
        assert!(is_denied(&backup, home.path()));
        assert!(is_denied(&backup.join("device-uuid"), home.path()));
    }

    #[test]
    fn allows_non_denied_paths() {
        let home = tempdir().unwrap();
        let downloads = home.path().join("Downloads");
        fs::create_dir_all(&downloads).unwrap();
        assert!(!is_denied(&downloads, home.path()));
    }

    #[test]
    fn protects_docker_container_paths() {
        let home = tempdir().unwrap();
        let docker = home.path().join("Library/Containers/com.docker.docker/Data");
        fs::create_dir_all(&docker).unwrap();
        assert!(is_protected_path(&docker.join("Docker.raw"), home.path()));
    }

    #[test]
    fn categorizes_video_files() {
        assert_eq!(
            file_category(Path::new("/tmp/movie.mp4")),
            "视频".to_string()
        );
    }
}
