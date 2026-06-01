# CleanMac Rename Design

**Status:** Implemented (2026-05-31)  
**Scope:** Full rebrand from 磁盘助手 to CleanMac (option C) with legacy data migration (option A).

## Summary

Rename the macOS app from **磁盘助手** to **CleanMac** in a single atomic release. Update user-visible strings, Tauri bundle identity, on-disk paths, internal code identifiers, and documentation. On first launch after upgrade, copy legacy settings and operation logs from old paths when new paths do not exist yet. Users must re-grant Full Disk Access because the Bundle ID changes.

## Decisions

| Topic | Choice |
|-------|--------|
| Rename depth | Full (UI + runtime paths + Bundle ID + code symbols) |
| Display name | **CleanMac** |
| Legacy data | One-time copy migration on first launch |
| Implementation style | Single release + centralized identity constants (approach 3) |

## Identity Mapping

| Dimension | Before | After |
|-----------|--------|-------|
| User-visible name | 磁盘助手 | **CleanMac** |
| Bundle ID | `com.canglang.diskcleaner` | `com.canglang.cleanmac` |
| Cargo package | `disk-cleaner-desktop` | `cleanmac-desktop` |
| Application Support dir | `~/Library/Application Support/磁盘助手/` | `~/Library/Application Support/CleanMac/` |
| Logs dir | `~/Library/Logs/磁盘助手/` | `~/Library/Logs/CleanMac/` |
| npm package name (`package.json`) | `cleanmac` | unchanged |

### Out of scope

- Functional copy containing 磁盘 as a word (e.g. 磁盘空间, 完全磁盘访问权限, 虚拟机磁盘 file category).
- GitHub repo name (already `cleanMac`).
- App icons and visual branding beyond name strings.

## Architecture

### Centralized constants

**Rust** — `src-tauri/src/app_identity.rs`:

- `PRODUCT_NAME`: `"CleanMac"`
- `LEGACY_APP_NAME`: `"磁盘助手"`
- Path helpers: `settings_path()`, `operations_log_path()`, legacy paths internal

`settings.rs` and `ops_log.rs` consume these helpers.

**Frontend** — `src/lib/appIdentity.ts`:

- `APP_DISPLAY_NAME = "CleanMac"`
- Used by `MacWindowTitleBar.tsx`, aligned with `index.html` / Tauri window title.

### Frontend layout

- `src/hooks/useScanSession.ts` — scan, permissions, selection
- `src/hooks/useDetailView.ts` — detail navigation, delete flow
- `src/hooks/useAppBootstrap.ts` — disk overview, settings load, focus refresh

## Legacy migration

See `app_identity::migrate_legacy_data()` called from `lib.rs` setup.

## Release notes (template)

- App renamed to **CleanMac** (formerly 磁盘助手).
- Settings and operation logs migrate on first launch.
- Re-grant **Full Disk Access** for the new app in System Settings.
- Optional: remove old `磁盘助手` folders under Application Support and Logs.
