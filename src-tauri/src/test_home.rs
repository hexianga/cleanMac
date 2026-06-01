//! Serializes HOME overrides across parallel unit tests.

#[cfg(test)]
use std::path::Path;
#[cfg(test)]
use std::sync::Mutex;

#[cfg(test)]
static HOME_TEST_LOCK: Mutex<()> = Mutex::new(());

#[cfg(test)]
pub fn with_home<F: FnOnce()>(home: &Path, f: F) {
    let _guard = HOME_TEST_LOCK.lock().expect("home test lock");
    let prev = std::env::var("HOME").ok();
    std::env::set_var("HOME", home);
    f();
    if let Some(value) = prev {
        std::env::set_var("HOME", value);
    } else {
        std::env::remove_var("HOME");
    }
}
