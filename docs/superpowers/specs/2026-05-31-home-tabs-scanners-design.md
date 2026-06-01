# Home Tabs, Scanner Reorder & File-Type Scan Design

**Status:** Approved (brainstorming, 2026-05-31)  
**Scope:** Sidebar navigation (文件分类 / 文件类型), scanner catalog changes, applications scanner, file-type scanners, cache impact UX, remove duplicate-files feature.

## Summary

Reorganize the dashboard into two sidebar tabs. **文件分类** shows seven cleanup categories in a new order (add applications, remove duplicates). **文件类型** shows five media/document cards scanned by extension under the user home directory. One-click scan behavior differs per tab. App/dev cache categories gain card-level impact modals plus detail-level delete reminders.

## Brainstorming Decisions

| Topic | Choice |
|-------|--------|
| 应用程序 | List `.app` bundles in `/Applications` and `~/Applications` by size; delete to Trash; safety `Review` |
| 文件类型 scan root | Recursive walk from `~/` (same rules as `large_files`: `is_denied`, `is_protected_path`, `include_node_modules`) |
| 文件类型 one-click | Always scan all five type scanners; not configurable in settings |
| 文件分类 one-click | Keep settings `oneClickScanIds` (updated list, no `duplicates`) |
| Tab switch state | Preserve all scanner results and selections per id across tabs |
| Cache impact UX | Card「影响说明」modal + detail Alert on first select + delete confirm line |
| Architecture | **Approach 1:** one Rust `Scanner` per card; shared `file_type_walk` module for five type scanners |

## Out of Scope

- Duplicate-file detection (removed entirely)
- File-type one-click configurability in settings
- “Unused app” heuristics (only list installed `.app` bundles)
- Clearing the other tab’s state when switching tabs
- iWork `.pages` / `.numbers` / `.key` in v1 (Office = doc/xls/ppt family + odt/ods/odp only)

---

## UI: Sidebar & Dashboard

### Layout

```
┌─────────────────────────────────────────────┐
│ MacWindowTitleBar                           │
├──────────┬──────────────────────────────────┤
│ 文件分类 │  DashboardHeader                 │
│ 文件类型 │  CategoryCard grid (tab-specific) │
└──────────┴──────────────────────────────────┘
```

- Add `AppShell.Navbar` (~120px): two entries — **文件分类** (default), **文件类型**.
- `App.tsx` holds `activeHomeTab: 'classification' | 'file_type'`.
- `DashboardView` receives `scannerOrder: ScannerId[]` derived from tab.
- `DashboardHeader` +「开始扫描」unchanged visually; `onScanAll` behavior branches on tab (see Scan orchestration).

### 文件分类 card order

| # | `scanner_id` | Display name |
|---|--------------|--------------|
| 1 | `downloads` | 下载残留 |
| 2 | `trash` | 废纸篓 |
| 3 | `applications` | 应用程序 |
| 4 | `app_caches` | 应用缓存 |
| 5 | `dev_caches` | 开发缓存 |
| 6 | `logs` | 日志与诊断 |
| 7 | `large_files` | 大文件 |

Constant: `CLASSIFICATION_SCANNER_ORDER` in `src/lib/categoryMeta.ts`.

### 文件类型 cards

| `scanner_id` | Display name |
|--------------|--------------|
| `file_video` | 视频 |
| `file_audio` | 音频 |
| `file_image` | 图片 |
| `file_pdf` | PDF |
| `file_office` | Office |

Constant: `FILE_TYPE_SCANNER_ORDER`.

`SCANNER_META` extended with icons/colors for new ids. `mergeCategories` accepts any order array passed from the active tab.

---

## Scan Orchestration

### Per-card scan

Unchanged: user taps「扫描」on one card → `runScan([scannerId])`.

### One-click「开始扫描」

| Active tab | Scanner ids sent to `start_scan` |
|------------|----------------------------------|
| 文件分类 | `appSettings.oneClickScanIds` (filtered to valid classification ids) |
| 文件类型 | Fixed: `file_video`, `file_audio`, `file_image`, `file_pdf`, `file_office` |

Implementation: extend `useScanSession.handleScanAll` (or caller in `App.tsx`) with `activeHomeTab` branch.

### Settings panel

- **一键扫描范围** checkboxes: only `CLASSIFICATION_SCANNER_ORDER` (7 items).
- Remove all duplicate-file fields: `scanDuplicates`, `duplicateMinBytes`, `maxHashBytes`.
- Keep: `largeFileMinBytes`, `includeNodeModules`.
- Default `oneClickScanIds`: `downloads`, `app_caches`, `dev_caches`, `logs`, `trash` (no `applications` or `large_files` by default, matching prior slow-scanner exclusion pattern).

### State

- `useScanSession`: initialize `scanState`, `selectedIdsByCategory`, progress maps for **all 12** scanner ids.
- Tab switch does not reset state.

---

## Rust: New & Removed Scanners

### Remove `duplicates`

- Delete `src-tauri/src/scan/duplicates.rs` and module registration.
- Remove from `ScanOrchestrator::full()` and all milestone lists.
- Remove settings fields and tests referencing duplicates.
- Remove frontend: `duplicates` id, `DUPLICATES_DISABLED_CONFIRM`, `scanGuardCopy` duplicates flow, slow-scan confirm for duplicates.

### `applications` scanner (new)

- File: `src-tauri/src/scan/applications.rs`
- Scan paths: `/Applications`, `home/Applications`
- For each directory entry: if path is a directory with `.app` extension (or `path.extension() == Some("app")` on bundle folder name ending in `.app`), compute size via existing `dir_size`, emit `ScanItem` with path, size, category label「应用程序」.
- `SafetyLevel::Review`
- Permission: if `/Applications` unreadable, category warnings + frontend `needs_permission` when appropriate (align with other non-trash scanners using FDA).

### File-type scanners (new)

- File: `src-tauri/src/scan/file_types.rs` (module) with shared `walk_file_types(home, ctx, extensions, items, warnings)` reusing large-files walk structure (same skip rules, `include_node_modules`).
- Five thin scanner structs or one parameterized scanner registered five times with distinct ids:
  - `file_video` — mp4, mov, mkv, avi, wmv, m4v, webm
  - `file_audio` — mp3, m4a, flac, wav, aac, ogg, wma
  - `file_image` — jpg, jpeg, png, gif, webp, heic, heif, bmp, tiff
  - `file_pdf` — pdf
  - `file_office` — doc, docx, xls, xlsx, ppt, pptx, odt, ods, odp
- No minimum size threshold (except protected paths).
- Sort items by `size_bytes` descending; `SafetyLevel::Review`.
- Register all five in `ScanOrchestrator::full()`.

### `ScanOrchestrator::by_ids`

Must resolve new ids; `name_for_id` includes new scanners.

---

## Cache Impact UX (`app_caches`, `dev_caches`)

### Card level

- `CategoryCard` optional prop `onShowImpact?` or detect `scannerId` in `{'app_caches','dev_caches'}`.
- Secondary control:「影响说明」or info `ActionIcon` (does not trigger card navigation).
- `CacheImpactModal` — title per category, body from `src/lib/cacheImpactCopy.ts` (static Chinese copy).

**App caches copy (summary):** Browser/IM/media app caches rebuild on use; first launch slower; some games re-download assets.

**Dev caches copy (summary):** Xcode DerivedData → full rebuild; package manager caches (npm/cargo/etc.) → re-download; may break offline builds until restored.

### Detail level

- `CategoryDetailView` when `scannerId` is `app_caches` or `dev_caches`:
  - Show dismissible `Alert` at top on first visit (session flag in component state or `sessionStorage` key per category).
  - Short one-line warning.
- `DeleteConfirmModal`: append one sentence about cache impact when category is app/dev caches.

---

## Frontend Type Model

```ts
type ClassificationScannerId =
  | 'downloads' | 'trash' | 'applications' | 'app_caches'
  | 'dev_caches' | 'logs' | 'large_files';

type FileTypeScannerId =
  | 'file_video' | 'file_audio' | 'file_image' | 'file_pdf' | 'file_office';

type ScannerId = ClassificationScannerId | FileTypeScannerId;
```

- `ALL_SCANNER_IDS` for session state init.
- `useDetailView`: remove duplicates guard; support new ids in navigation.
- `slowScanConfirmCopy`: add `applications` if slow; remove `duplicates` / large_files unchanged.

---

## Settings Migration

### Rust `AppSettings`

Remove: `scan_duplicates`, `duplicate_min_bytes`, `max_hash_bytes`.

On load: strip `duplicates` from `one_click_scan_ids` if present in JSON file.

### TypeScript `AppSettings`

Mirror Rust shape; update `normalizeSettings` in `SettingsPanel`.

---

## Testing

| Area | Tests |
|------|-------|
| Rust | `applications` finds `.app` in temp dirs; extension filter per file type; settings default without duplicates |
| Frontend | Tab renders correct card count; `handleScanAll` file_type branch sends 5 ids; cache impact button opens modal |
| Integration | Manual: FDA for `/Applications`; tab switch retains scan badges |

---

## Documentation

- `README.md`: remove duplicate-files bullet; add file-type tab and applications category.
- Supersedes duplicate-related behavior in `docs/design/2026-05-31-settings-panel-design.md` (duplicates guard removed with feature).

---

## File Touch List (implementation reference)

| File | Change |
|------|--------|
| `src/lib/categoryMeta.ts` | Orders, meta, types |
| `src/lib/types.ts` | `AppSettings` |
| `src/lib/cacheImpactCopy.ts` | New |
| `src/components/CacheImpactModal.tsx` | New |
| `src/components/CategoryCard.tsx` | Impact button |
| `src/components/DashboardView.tsx` | `scannerOrder` prop |
| `src/components/HomeSidebar.tsx` | New |
| `src/App.tsx` | Navbar, tab state, scan-all branch |
| `src/hooks/useScanSession.ts` | 12 ids, scan-all branch |
| `src/hooks/useDetailView.ts` | Remove duplicates guard |
| `src/components/SettingsPanel.tsx` | Remove duplicate fields |
| `src-tauri/src/scan/applications.rs` | New |
| `src-tauri/src/scan/file_types.rs` | New |
| `src-tauri/src/scan/mod.rs` | Register scanners |
| `src-tauri/src/scan/duplicates.rs` | Delete |
| `src-tauri/src/settings.rs` | Fields + migration |
| `README.md` | Feature list |
