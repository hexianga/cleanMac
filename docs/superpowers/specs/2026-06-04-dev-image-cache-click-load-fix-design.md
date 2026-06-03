# Dev Image Cache: Click-to-Load & Repo-Root Path Fix

**Status:** Approved (2026-06-04)  
**Context:** After `pnpm dev:cache-images` at repo root, clicking the「图片」card in `tauri dev` still shows「未扫描」and requires using「扫描」. Root cause: `dev_cache_dir()` uses `current_dir()`, which is often `src-tauri/` under Tauri dev, so `.dev-cache/file_image.json` at repo root is not found. Startup `devScanCacheExists` also gates `canOpen`, so the card is not clickable when the path check fails.

**Related:** `docs/superpowers/specs/2026-06-04-file-type-dev-cache-and-min-size-design.md` (original dev cache feature).

## Goal

In development (`import.meta.env.DEV`), opening the「图片」category should **always** attempt to load `.dev-cache/file_image.json` from the repository root—no manual「扫描」 needed for list optimization work. If the file is missing or invalid, show a clear error telling the user to run `pnpm dev:cache-images`.

## Decisions

| Topic | Choice |
|-------|--------|
| Click behavior | **A:** Always try read on card click; do not require prior `devScanCacheExists` for navigation |
| Path resolution | Walk up from `current_dir()` to find repo root (see below); keep `CLEANMAC_DEV_CACHE_DIR` override |
| Scan button (DEV + `file_image`) | Hide「扫描」when cache file exists; show「重载缓存」instead; show「扫描」only when cache missing (optional real scan) |
| Card clickability (DEV + `file_image`) | Always clickable unless `scanning` |
| `devScanCacheExists` on startup | Optional badge only（「调试缓存可用」）; must not gate `canOpen` |

## Non-goals

- Production build behavior changes
- Auto-load cache on app start or tab switch
- Dev cache for other file-type scanners in this change

## Architecture

**Rust:** Centralize repo-root resolution in `dev_cache_dir()`; CLI and Tauri commands share it.

**Frontend:** `handleOpenCategory('file_image')` in DEV always calls `loadDevScanCache` first; open detail only after success. `CategoryCard` DEV rules for `canOpen` and button labels.

## Repo-root resolution (`dev_cache_dir`)

Order:

1. `CLEANMAC_DEV_CACHE_DIR` if set → use as cache directory (not parent of json file; directory itself contains `{scanner_id}.json`).
2. Walk parents from `std::env::current_dir()` (max 8 levels):
   - If `join(".dev-cache")` exists as directory → use it.
   - If directory contains root `package.json` with `"dev:cache-images"` script → use `that_dir/.dev-cache` (create not required for exists check).
3. Fallback: `current_dir()/.dev-cache`.

`dev_cache_path(scanner_id)` → `{dev_cache_dir()}/{scanner_id}.json`.

## Frontend behavior

### `handleOpenCategory` (DEV, `file_image`)

```
click 图片 card
  → setError(null)
  → loadDevScanCache('file_image')  // always invokes read_dev_scan_cache
  → on success: setDetailScannerId + view detail
  → on failure: setError(用户文案), stay on dashboard
```

Remove `devScanCacheExists` guard before load on click.

### `CategoryCard` (DEV, `file_image`)

- `canOpen`: `scanState !== 'scanning'` (always allow open in DEV for this id).
- Footer button:
  - If `devScanCacheExists` true: label「重载缓存」, calls `onReloadDevCache` or re-use `onOpen` load path.
  - If false: keep「扫描」→ `onScan`.

Alternatively implement「重载缓存」 as `onScan` wired to `loadDevScanCache` in parent for DEV only.

### Startup `useEffect`

Keep `devScanCacheExists` for subtext「调试缓存可用」only; refresh after successful load.

### Error messages (Chinese)

| Case | Message |
|------|---------|
| Missing file | `未找到调试缓存。请在仓库根目录执行：pnpm dev:cache-images` |
| Invalid JSON | `调试缓存损坏，请重新执行 pnpm dev:cache-images` |

## Files to change

| File | Change |
|------|--------|
| `src-tauri/src/dev_cache.rs` | `find_dev_cache_dir()`, tests with cwd `src-tauri` |
| `src/hooks/useDetailView.ts` | Always load on DEV image open; open detail only on success |
| `src/hooks/useScanSession.ts` | Export reload helper; refresh `devCacheAvailable` after load |
| `src/components/CategoryCard.tsx` | DEV `file_image` canOpen + button labels |
| `src/App.tsx` / `DashboardView` | Wire reload handler if needed |

## Testing

- [ ] Rust: cwd `repo/src-tauri`, cache at `repo/.dev-cache/file_image.json` → `read_dev_cache` succeeds
- [ ] Manual: `pnpm dev:cache-images` at root → `pnpm tauri:dev` → click 图片 only → large virtualized list, no scan click
- [ ] Manual: delete `.dev-cache` → click 图片 → error message, no empty detail
- [ ] `cargo test` + `pnpm test` pass

## Risks

| Risk | Mitigation |
|------|------------|
| Wrong repo detected in monorepo | Prefer directory that already has `.dev-cache` |
| Slow read blocks UI | Acceptable for dev; optional loading state later |
