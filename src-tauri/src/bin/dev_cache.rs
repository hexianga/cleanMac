use app_lib::dev_cache;
use app_lib::model::ScanContext;
use app_lib::scan::file_types::{FileImageScanner, FileVideoScanner};
use app_lib::scan::Scanner;
use app_lib::settings;

fn main() {
    let scanner_id = match std::env::args().nth(1).as_deref() {
        Some("file_image") => "file_image",
        Some("file_video") => "file_video",
        _ => {
            eprintln!("Usage: dev_cache <file_image|file_video>");
            std::process::exit(2);
        }
    };

    let settings = settings::load_settings();
    let ctx = match ScanContext::with_settings(settings) {
        Ok(ctx) => ctx,
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(1);
        }
    };

    let category = match scanner_id {
        "file_image" => FileImageScanner.scan(&ctx),
        "file_video" => FileVideoScanner.scan(&ctx),
        _ => unreachable!(),
    };

    let category = match category {
        Ok(c) => c,
        Err(e) => {
            eprintln!("scan failed: {e}");
            std::process::exit(1);
        }
    };

    match dev_cache::write_dev_cache(scanner_id, &category) {
        Ok(path) => {
            println!(
                "Wrote {} items ({} bytes) to {}",
                category.items.len(),
                category.total_bytes,
                path.display()
            );
        }
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(1);
        }
    }
}
