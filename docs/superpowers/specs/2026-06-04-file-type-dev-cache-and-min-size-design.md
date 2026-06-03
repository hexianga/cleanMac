# File-Type Dev Cache, Min-Size Settings & List Virtualization Design

**Status:** Approved (2026-06-04)  
**Context:** Scanning `file_image` (and other file-type categories) can return tens of thousands of items. `DetailItemList` renders all rows at once, freezing the WebView. User wants a dev workflow to pre-scan images to a repo-local cache file, default to the file-type tab in dev, and load cache on card click—while production keeps the normal in-memory scan path but gains per-type minimum size filters and a virtualized detail list.

## Decisions (brainstorming)

| Topic | Choice |
|-------|--------|
| Temp file / lazy load scope | **Dev only** (`import.meta.env.DEV`); production unchanged for scan/storage |
| Min-size settings | **Per file type** (video, audio, image, PDF, office) |
| Dev cache generation | **Standalone CLI** (`pnpm dev:cache-images`), not in-app button |
| Dev load on card click | **Load full JSON into memory** once (same as today’s scan IPC shape) |
| Cache location | **Repo** `.dev-cache/file_image.json`, gitignored |
| List performance fix | **Virtual scrolling** in `DetailItemList` (dev + production) |

## Goals

1. **Dev:** Run a CLI from repo root to scan images and write `.dev-cache/file_image.json` using the same Rust scanner and user settings as production.
2. **Dev:** App opens on **文件类型** tab; clicking **图片** loads cache into session state if the file exists (no full scan).
3. **Production:** Settings UI exposes minimum file size (MB) per file-type scanner; scanners skip files below threshold.
4. **All builds:** Detail list uses virtual scrolling so large item counts do not block the UI thread.

## Non-goals

- Dev cache for video/audio/pdf/office (only `file_image` in v1; same pattern can extend later)
- On-disk scan results or pagination IPC in production
- Optimistic / fake JSON fixtures without real scan
- In-app “generate cache” button
- Loading cache on app startup (only on opening the image category in dev)
- Changing classification-tab scan behavior

## Architecture (recommended approach)

**Rust CLI + debug Tauri commands + frontend DEV hooks + `@tanstack/react-virtual`.**

```
pnpm dev:cache-images
  → dev_cache binary → FileImageScanner + Settings
  → .dev-cache/file_image.json

tauri dev (repo root cwd)
  → default activeHomeTab = file_type
  → user opens 图片 card
  → read_dev_scan_cache("file_image") → merge into categories
  → DetailItemList (virtualized) renders rows

production startScan(file_image)
  → walk with fileImageMinBytes (etc.)
  → IPC full category → virtualized DetailItemList
```

## Components

### 1. Dev cache CLI

- **Entry:** `pnpm dev:cache-images` runs Rust binary (e.g. `dev_cache`) from `src-tauri`.
- **Output:** `.dev-cache/file_image.json` — serialized `ScanCategoryResult` (same shape as scan IPC).
- **Settings:** Load persisted app settings (same path as `get_settings` / `settings.json`) so min-byte filters match production.
- **CWD:** Must be repository root (relative `.dev-cache/`). Document in README.
- **Tests:** Use env var `CLEANMAC_DEV_CACHE_DIR` pointing at a temp dir so tests do not write into the repo.

### 2. Debug Tauri commands

| Command | Behavior |
|---------|----------|
| `dev_scan_cache_exists(scanner_id: String) -> bool` | `current_dir().join(".dev-cache/{scanner_id}.json").is_file()` |
| `read_dev_scan_cache(scanner_id: String) -> Result<ScanCategoryResult, String>` | Read + `serde_json` parse; clear error if missing/invalid |

- Registered for all builds is acceptable if commands only no-op or error outside dev; **preferred:** frontend only calls them when `import.meta.env.DEV` is true.
- Path: `std::env::current_dir()` + `.dev-cache/{scanner_id}.json`. **Requirement:** `tauri dev` and CLI both run with cwd = repo root.

### 3. Frontend (dev)

- `App.tsx` initial state: `activeHomeTab = import.meta.env.DEV ? "file_type" : "classification"`.
- `useScanSession` (or dedicated helper): `loadDevScanCache(scannerId)` — invoke `read_dev_scan_cache`, upsert into `categories`, set `scanState[scannerId] = "scanned"`, apply default selection rules like post-scan.
- `useDetailView.handleOpenCategory`: when `import.meta.env.DEV && scannerId === "file_image"`, await `loadDevScanCache` if `dev_scan_cache_exists` (or try read and handle missing).
- Optional UX: if cache exists, category card subtext **调试缓存可用** (via `dev_scan_cache_exists` on dashboard mount or per-card check).
- If cache missing: unchanged (unscanned / user can run normal scan).

### 4. Settings — per file type min bytes

**Rust `Settings` / TS `AppSettings` fields (camelCase JSON):**

| Field | Default |
|-------|---------|
| `fileImageMinBytes` | `0` |
| `fileVideoMinBytes` | `10 * 1024 * 1024` |
| `fileAudioMinBytes` | `1 * 1024 * 1024` |
| `filePdfMinBytes` | `1 * 1024 * 1024` |
| `fileOfficeMinBytes` | `1 * 1024 * 1024` |

- Apply in `src-tauri/src/scan/file_types.rs` after extension match: skip file if `metadata.len() < threshold` for that scanner’s id.
- Map scanner id → threshold in one helper to avoid duplication.
- `SettingsPanel`: new section **文件类型扫描**, five `NumberInput` (MB), tooltip explains each category.
- Existing `largeFileMinBytes` unchanged (large-files scanner only).

### 5. Detail list virtualization

- Add dependency `@tanstack/react-virtual`.
- `DetailItemList`: virtualize `rows` from `flattenDetailGroups` with fixed heights `DETAIL_ITEM_ROW_HEIGHT` / `DETAIL_GROUP_HEADER_HEIGHT`.
- Scroll container: parent in `CategoryDetailView` / detail scroll area must have bounded height; use `useVirtualizer` with `getScrollElement` pointing at the scrolling ancestor (or wrap list in `ScrollArea` with `flex: 1` + `minHeight: 0`).
- Group headers and item rows remain separate virtual items (variable row heights: use per-index `estimateSize` or two virtualizers—prefer single list with `measureElement` only if needed; fixed heights preferred per existing constants).

### 6. Repository hygiene

- `.gitignore`: add `.dev-cache/`
- README: document `pnpm dev:cache-images` then `pnpm tauri:dev` workflow.

## Data flow (dev open image)

```
User clicks 图片 card
  → handleOpenCategory("file_image")
  → [DEV] dev_scan_cache_exists? 
       yes → read_dev_scan_cache → setCategories / loadDevScanCache
       no  → open detail with current category (may be empty unscanned)
  → setView("detail")
  → DetailItemList virtualizer renders visible rows only
```

## Error handling

| Case | Behavior |
|------|----------|
| Invalid/missing cache JSON | `setError` with message; stay on detail or dashboard without crash |
| CLI scan permission denied | Exit code ≠ 0, stderr message |
| All files below min size | Empty category, card copy「未发现可清理项」 |
| `read_dev_scan_cache` called in production build | Frontend never calls; command may return err if mis-invoked |

## Testing

- [ ] Rust unit test: `walk_file_types` skips files under `fileImageMinBytes`
- [ ] Rust: `dev_cache` writes valid JSON under `CLEANMAC_DEV_CACHE_DIR`
- [ ] `pnpm test && pnpm build`
- [ ] Manual: `pnpm dev:cache-images` → `pnpm tauri:dev` → file_type tab default → open 图片 → list scrolls smoothly
- [ ] Manual: raise `fileImageMinBytes` in settings → re-run CLI → fewer items
- [ ] Manual: production build does not depend on `.dev-cache` existing

## Files (expected touch list)

| File | Change |
|------|--------|
| `src-tauri/src/bin/dev_cache.rs` (or `dev_cache/main.rs`) | CLI |
| `src-tauri/Cargo.toml` | `[[bin]]` dev_cache |
| `src-tauri/src/commands.rs` | `dev_scan_cache_exists`, `read_dev_scan_cache` |
| `src-tauri/src/lib.rs` | register commands |
| `src-tauri/src/settings.rs` | five min-byte fields + defaults |
| `src-tauri/src/scan/file_types.rs` | size filter |
| `src/lib/types.ts` | AppSettings fields |
| `src/lib/api.ts` | invoke wrappers |
| `src/components/SettingsPanel.tsx` | five MB inputs |
| `src/components/DetailItemList.tsx` | virtualization |
| `src/hooks/useScanSession.ts` | `loadDevScanCache` |
| `src/hooks/useDetailView.ts` | dev open category hook |
| `src/App.tsx` | default tab |
| `package.json` | `dev:cache-images` script, `@tanstack/react-virtual` |
| `.gitignore` | `.dev-cache/` |
| `README.md` | dev workflow |

## Risks

| Risk | Mitigation |
|------|------------|
| `tauri dev` cwd not repo root | Document; optional `CLEANMAC_DEV_CACHE_DIR` for cache path in both CLI and commands |
| Virtualizer scroll parent wrong | QA in Tauri WebView; use explicit scroll ref on detail main |
| Dev loads full cache still heavy in memory | Acceptable for dev; virtualization fixes UI thread freeze |
| User expects prod disk cache | Spec limits to dev-only cache |

## Future extensions (out of v1)

- `dev:cache-file-video` etc. using same `.dev-cache/{scanner_id}.json` convention
- `dev_scan_cache_exists` driven badge on all file-type cards
