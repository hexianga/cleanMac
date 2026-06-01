use std::fs;
use std::path::Path;

use crate::model::{
    emit_scan_progress, make_scan_item_full, SafetyLevel, ScanCategoryResult, ScanContext,
    ScanItem,
};
use crate::scan::walk::{
    file_category, file_size_on_disk_from_metadata, is_denied, is_protected_path, is_sparse_file,
    logical_file_size,
};
use crate::scan::Scanner;

pub const VIDEO_EXT: &[&str] = &["mp4", "mov", "mkv", "avi", "wmv", "m4v", "webm"];
pub const AUDIO_EXT: &[&str] = &["mp3", "m4a", "flac", "wav", "aac", "ogg", "wma"];
pub const IMAGE_EXT: &[&str] = &["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "tiff"];
pub const PDF_EXT: &[&str] = &["pdf"];
pub const OFFICE_EXT: &[&str] = &[
    "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp",
];

pub fn ext_matches(path: &Path, extensions: &[&str]) -> bool {
    let ext = path
        .extension()
        .and_then(|name| name.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    extensions.iter().any(|candidate| *candidate == ext)
}

fn walk_file_types(
    dir: &Path,
    home: &Path,
    ctx: &ScanContext,
    scanner_id: &str,
    extensions: &[&str],
    include_node_modules: bool,
    items: &mut Vec<ScanItem>,
    warnings: &mut Vec<String>,
    visited: &mut u32,
) {
    if is_denied(dir, home) {
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

        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(error) => {
                warnings.push(format!("无法读取 {}: {error}", path.display()));
                continue;
            }
        };

        if file_type.is_dir() {
            if should_skip_dir(&path, include_node_modules) {
                continue;
            }
            walk_file_types(
                &path,
                home,
                ctx,
                scanner_id,
                extensions,
                include_node_modules,
                items,
                warnings,
                visited,
            );
            continue;
        }

        if !file_type.is_file() || !ext_matches(&path, extensions) {
            continue;
        }

        *visited += 1;
        if *visited % 100 == 0 {
            let total_bytes = items.iter().map(|item| item.size_bytes).sum();
            emit_scan_progress(
                ctx,
                scanner_id,
                "scanning",
                items.len() as u32,
                total_bytes,
            );
        }

        let meta = match entry.metadata() {
            Ok(meta) => meta,
            Err(error) => {
                warnings.push(format!("无法读取 {}: {error}", path.display()));
                continue;
            }
        };

        let allocated = match file_size_on_disk_from_metadata(&meta) {
            Ok(size) => size,
            Err(error) => {
                warnings.push(format!("无法读取 {}: {error}", path.display()));
                continue;
            }
        };

        let logical = logical_file_size(&meta);
        let logical_size_bytes = if is_sparse_file(&meta) {
            Some(logical)
        } else {
            None
        };

        let protected = is_protected_path(&path, home);
        let (safety_level, deletable) = if protected {
            (SafetyLevel::DisplayOnly, false)
        } else {
            (SafetyLevel::Review, true)
        };

        items.push(make_scan_item_full(
            scanner_id,
            &path.to_path_buf(),
            allocated,
            logical_size_bytes,
            Some(file_category(&path)),
            safety_level,
            false,
            deletable,
            None,
        ));
    }
}

fn should_skip_dir(path: &Path, include_node_modules: bool) -> bool {
    let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
        return false;
    };

    if name == ".git" {
        return true;
    }

    !include_node_modules && name == "node_modules"
}

struct FileTypeScanner {
    id: &'static str,
    name: &'static str,
    extensions: &'static [&'static str],
}

impl Scanner for FileTypeScanner {
    fn id(&self) -> &'static str {
        self.id
    }

    fn name(&self) -> &'static str {
        self.name
    }

    fn default_safety(&self) -> SafetyLevel {
        SafetyLevel::Review
    }

    fn scan(&self, ctx: &ScanContext) -> Result<ScanCategoryResult, String> {
        let mut items = Vec::new();
        let mut warnings = Vec::new();
        let mut visited = 0u32;

        walk_file_types(
            &ctx.home,
            &ctx.home,
            ctx,
            self.id(),
            self.extensions,
            ctx.settings.include_node_modules,
            &mut items,
            &mut warnings,
            &mut visited,
        );

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

pub struct FileVideoScanner;
pub struct FileAudioScanner;
pub struct FileImageScanner;
pub struct FilePdfScanner;
pub struct FileOfficeScanner;

macro_rules! file_type_scanner {
    ($struct_name:ident, $id:expr, $name:expr, $ext:ident) => {
        impl Scanner for $struct_name {
            fn id(&self) -> &'static str {
                $id
            }

            fn name(&self) -> &'static str {
                $name
            }

            fn default_safety(&self) -> SafetyLevel {
                SafetyLevel::Review
            }

            fn scan(&self, ctx: &ScanContext) -> Result<ScanCategoryResult, String> {
                FileTypeScanner {
                    id: $id,
                    name: $name,
                    extensions: $ext,
                }
                .scan(ctx)
            }
        }
    };
}

file_type_scanner!(FileVideoScanner, "file_video", "视频", VIDEO_EXT);
file_type_scanner!(FileAudioScanner, "file_audio", "音频", AUDIO_EXT);
file_type_scanner!(FileImageScanner, "file_image", "图片", IMAGE_EXT);
file_type_scanner!(FilePdfScanner, "file_pdf", "PDF", PDF_EXT);
file_type_scanner!(FileOfficeScanner, "file_office", "Office", OFFICE_EXT);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_extensions_case_insensitive() {
        assert!(ext_matches(Path::new("/a/file.MP4"), VIDEO_EXT));
        assert!(!ext_matches(Path::new("/a/file.pdf"), VIDEO_EXT));
    }
}
