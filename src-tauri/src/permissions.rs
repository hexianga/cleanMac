use std::io::ErrorKind;
use std::path::PathBuf;

use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PermissionStatus {
    pub ok: bool,
    pub needs_full_disk_access: bool,
    pub needs_trash_access: bool,
    pub needs_downloads_access: bool,
}

pub fn check_permissions() -> PermissionStatus {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"));
    let caches_path = home.join("Library/Caches");
    let trash_path = home.join(".Trash");

    let needs_full_disk_access = match std::fs::read_dir(&caches_path) {
        Ok(_) => false,
        Err(error) if error.kind() == ErrorKind::PermissionDenied => true,
        Err(_) => false,
    };

    let needs_trash_access = match std::fs::read_dir(&trash_path) {
        Ok(_) => false,
        Err(error) if error.kind() == ErrorKind::PermissionDenied => true,
        Err(_) => false,
    };

    let downloads_path = home.join("Downloads");
    let needs_downloads_access = match std::fs::read_dir(&downloads_path) {
        Ok(_) => false,
        Err(error) if error.kind() == ErrorKind::PermissionDenied => true,
        Err(_) => false,
    };

    PermissionStatus {
        ok: !needs_full_disk_access && !needs_downloads_access,
        needs_full_disk_access,
        needs_trash_access,
        needs_downloads_access,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ok_when_no_full_disk_or_downloads_blockers() {
        let status = check_permissions();
        assert_eq!(
            status.ok,
            !status.needs_full_disk_access && !status.needs_downloads_access
        );
    }

    #[test]
    fn permission_status_includes_trash_access_field() {
        let status = check_permissions();
        let json = serde_json::to_value(&status).expect("serialize PermissionStatus");
        assert!(json.get("needsTrashAccess").is_some());
        assert!(json.get("needsFullDiskAccess").is_some());
        assert!(json.get("needsDownloadsAccess").is_some());
    }
}
