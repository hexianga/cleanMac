mod ops_log;

use std::fs;
use std::path::Path;

pub use ops_log::log_operation;

pub fn trash_path(path: &Path) -> Result<(), String> {
    trash::delete(path).map_err(|e| e.to_string())
}

pub fn empty_trash(home: &Path) -> Result<(), String> {
    let trash_dir = home.join(".Trash");
    if !trash_dir.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(&trash_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        trash_path(&entry.path())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn moves_file_to_trash() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("a.txt");
        fs::write(&file, b"x").unwrap();
        trash_path(&file).expect("trash");
        assert!(!file.exists());
    }
}
