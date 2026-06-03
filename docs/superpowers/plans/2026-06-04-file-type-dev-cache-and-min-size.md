# File-Type Dev Cache, Min-Size & Virtual List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dev CLI caches `file_image` scan to `.dev-cache/`; dev app defaults to file-type tab and loads cache on image card open; production scans honor per-type minimum file sizes; detail list virtualizes rows to prevent UI freeze.

**Architecture:** Extend `Settings` and `file_types` walk with per-scanner min bytes; add `dev_cache` Rust module + `dev_cache` binary + two Tauri read commands; frontend DEV hooks call cache APIs; `@tanstack/react-virtual` in `DetailItemList` bound to the detail scroll container.

**Tech Stack:** Rust 2021, Tauri 2, React 19, Mantine 7, Vitest, `@tanstack/react-virtual`.

**Spec:** `docs/superpowers/specs/2026-06-04-file-type-dev-cache-and-min-size-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src-tauri/src/dev_cache.rs` | Cache dir/path resolution, read/write JSON |
| `src-tauri/src/bin/dev_cache.rs` | CLI entry: scan + write cache |
| `src-tauri/src/settings.rs` | Five `file_*_min_bytes` fields |
| `src-tauri/src/scan/file_types.rs` | Skip files below min size |
| `src-tauri/src/commands.rs` | `dev_scan_cache_exists`, `read_dev_scan_cache` |
| `src/lib/types.ts` | `AppSettings` fields |
| `src/lib/api.ts` | invoke wrappers |
| `src/lib/categoryCardCopy.ts` | Dev cache hint subtext |
| `src/components/SettingsPanel.tsx` | Five MB inputs |
| `src/components/DetailItemList.tsx` | Virtual scrolling |
| `src/components/CategoryDetailView.tsx` | Forward scroll ref |
| `src/App.tsx` | Default tab + scroll ref |
| `src/hooks/useScanSession.ts` | `loadDevScanCache`, selection merge |
| `src/hooks/useDetailView.ts` | Dev open-category load |
| `package.json` | script + dependency |

---

### Task 1: Per-type min bytes (settings + scanner filter)

**Files:**
- Modify: `src-tauri/src/settings.rs`
- Modify: `src-tauri/src/scan/file_types.rs`
- Modify: `src/lib/types.ts`
- Modify: `src/components/SettingsPanel.tsx`
- Test: `src-tauri/src/scan/file_types.rs` (`#[cfg(test)]`)

- [ ] **Step 1: Add defaults and fields to `Settings`**

In `src-tauri/src/settings.rs`, add before `pub struct Settings`:

```rust
fn default_file_image_min_bytes() -> u64 {
    0
}
fn default_file_video_min_bytes() -> u64 {
    10 * 1024 * 1024
}
fn default_file_audio_min_bytes() -> u64 {
    1024 * 1024
}
fn default_file_pdf_min_bytes() -> u64 {
    1024 * 1024
}
fn default_file_office_min_bytes() -> u64 {
    1024 * 1024
}
```

Add to `Settings`:

```rust
    #[serde(default = "default_file_image_min_bytes")]
    pub file_image_min_bytes: u64,
    #[serde(default = "default_file_video_min_bytes")]
    pub file_video_min_bytes: u64,
    #[serde(default = "default_file_audio_min_bytes")]
    pub file_audio_min_bytes: u64,
    #[serde(default = "default_file_pdf_min_bytes")]
    pub file_pdf_min_bytes: u64,
    #[serde(default = "default_file_office_min_bytes")]
    pub file_office_min_bytes: u64,
```

Add public helper on `Settings`:

```rust
impl Settings {
    pub fn min_bytes_for_scanner(&self, scanner_id: &str) -> u64 {
        match scanner_id {
            "file_image" => self.file_image_min_bytes,
            "file_video" => self.file_video_min_bytes,
            "file_audio" => self.file_audio_min_bytes,
            "file_pdf" => self.file_pdf_min_bytes,
            "file_office" => self.file_office_min_bytes,
            _ => 0,
        }
    }
}
```

- [ ] **Step 2: Write failing test for size filter**

In `src-tauri/src/scan/file_types.rs` `mod tests`:

```rust
    #[test]
    fn skips_files_below_min_bytes() {
        use super::*;
        use crate::model::ScanContext;
        use crate::settings::Settings;
        use crate::test_home::with_home;
        use std::fs;
        use tempfile::tempdir;

        let dir = tempdir().unwrap();
        let home = dir.path();
        let tiny = home.join("tiny.jpg");
        fs::write(&tiny, b"x").unwrap();

        let mut settings = Settings::default();
        settings.file_image_min_bytes = 1024;

        let ctx = ScanContext {
            settings,
            ..ScanContext::new().unwrap()
        };
        // Override home in ctx if ScanContext stores home from new() — set home to temp:
        // Use with_home wrapper if ScanContext::new() reads HOME; inside with_home:
        let mut items = Vec::new();
        let mut warnings = Vec::new();
        let mut visited = 0u32;
        walk_file_types(
            home,
            home,
            &ctx,
            "file_image",
            IMAGE_EXT,
            false,
            &mut items,
            &mut warnings,
            &mut visited,
        );
        assert!(items.is_empty());
    }
```

Adjust test setup to match how other scanner tests bind `home` (read `large_files.rs` tests or `test_home::with_home`).

- [ ] **Step 3: Run test — expect FAIL**

Run: `cd src-tauri && cargo test skips_files_below_min_bytes -- --nocapture`  
Expected: FAIL (tiny.jpg included today)

- [ ] **Step 4: Pass `min_bytes` into `walk_file_types` and filter**

Add parameter `min_bytes: u64` to `walk_file_types` signature and recursive calls.

After reading `meta`, before building item:

```rust
        let logical = logical_file_size(&meta);
        if logical < min_bytes {
            continue;
        }
```

In `FileTypeScanner::scan`:

```rust
        let min_bytes = ctx.settings.min_bytes_for_scanner(self.id());
        walk_file_types(
            ...
            min_bytes,
            ...
        );
```

Update macro-generated scanners (`FileImageScanner` etc.) — they delegate to `FileTypeScanner` which already uses `self.id()`.

- [ ] **Step 5: Run test — expect PASS**

Run: `cd src-tauri && cargo test file_types -- --nocapture`  
Expected: PASS

- [ ] **Step 6: TypeScript `AppSettings` + Settings UI**

`src/lib/types.ts`:

```typescript
export interface AppSettings {
  largeFileMinBytes: number;
  includeNodeModules: boolean;
  oneClickScanIds: string[];
  fileImageMinBytes: number;
  fileVideoMinBytes: number;
  fileAudioMinBytes: number;
  filePdfMinBytes: number;
  fileOfficeMinBytes: number;
}
```

In `SettingsPanel.tsx`, after the node_modules row, add section title and five rows (mirror large-file MB pattern):

```typescript
const FILE_TYPE_MIN_FIELDS = [
  { key: "fileImageMinBytes" as const, label: "图片最小体积（MB）", tooltip: "小于此大小的图片文件不会出现在「图片」类别" },
  { key: "fileVideoMinBytes" as const, label: "视频最小体积（MB）", tooltip: "…" },
  { key: "fileAudioMinBytes" as const, label: "音频最小体积（MB）", tooltip: "…" },
  { key: "filePdfMinBytes" as const, label: "PDF 最小体积（MB）", tooltip: "…" },
  { key: "fileOfficeMinBytes" as const, label: "Office 最小体积（MB）", tooltip: "…" },
] as const;
```

Each `NumberInput` uses `settings[key] / MB` on change `settings[key] = mb * MB`.

Extend `normalizeSettings` to default missing fields (e.g. image 0, video 10, others 1 MB) when loading old JSON without new keys.

- [ ] **Step 7: Verify**

Run: `pnpm exec tsc --noEmit && cd src-tauri && cargo test settings file_types -- --nocapture`

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/settings.rs src-tauri/src/scan/file_types.rs src/lib/types.ts src/components/SettingsPanel.tsx
git commit -m "feat: per file-type minimum scan size in settings and scanner"
```

---

### Task 2: Dev cache module + CLI binary

**Files:**
- Create: `src-tauri/src/dev_cache.rs`
- Create: `src-tauri/src/bin/dev_cache.rs`
- Modify: `src-tauri/src/lib.rs` (add `mod dev_cache;`)
- Modify: `src-tauri/Cargo.toml`
- Modify: `package.json`

- [ ] **Step 1: Add `dev_cache.rs`**

```rust
use std::fs;
use std::path::{Path, PathBuf};

use crate::model::ScanCategoryResult;

pub fn dev_cache_dir() -> Result<PathBuf, String> {
    if let Ok(dir) = std::env::var("CLEANMAC_DEV_CACHE_DIR") {
        return Ok(PathBuf::from(dir));
    }
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    Ok(cwd.join(".dev-cache"))
}

pub fn dev_cache_path(scanner_id: &str) -> Result<PathBuf, String> {
    Ok(dev_cache_dir()?.join(format!("{scanner_id}.json")))
}

pub fn dev_cache_exists(scanner_id: &str) -> Result<bool, String> {
    Ok(dev_cache_path(scanner_id)?.is_file())
}

pub fn write_dev_cache(scanner_id: &str, category: &ScanCategoryResult) -> Result<PathBuf, String> {
    let path = dev_cache_path(scanner_id)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(category).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(path)
}

pub fn read_dev_cache(scanner_id: &str) -> Result<ScanCategoryResult, String> {
    let path = dev_cache_path(scanner_id)?;
    if !path.is_file() {
        return Err(format!("调试缓存不存在: {}", path.display()));
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| format!("调试缓存 JSON 无效: {e}"))
}
```

Add `mod dev_cache;` to `src-tauri/src/lib.rs`.

- [ ] **Step 2: Add binary `src/bin/dev_cache.rs`**

```rust
use app_lib::dev_cache;
use app_lib::model::ScanContext;
use app_lib::scan::file_types::FileImageScanner;
use app_lib::scan::Scanner;
use app_lib::settings;

fn main() {
    let scanner_id = std::env::args()
        .nth(1)
        .filter(|s| s == "file_image")
        .unwrap_or_else(|| {
            eprintln!("Usage: dev_cache file_image");
            std::process::exit(2);
        });

    let settings = settings::load_settings();
    let ctx = match ScanContext::with_settings(settings) {
        Ok(ctx) => ctx,
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(1);
        }
    };

    let scanner = FileImageScanner;
    let category = match scanner.scan(&ctx) {
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
```

**Note for implementer:** If `ScanContext` has no `with_settings`, add:

```rust
impl ScanContext {
    pub fn with_settings(settings: Settings) -> Result<Self, String> {
        let mut ctx = Self::new()?;
        ctx.settings = settings;
        Ok(ctx)
    }
}
```

in `model.rs` (or equivalent).

- [ ] **Step 3: `Cargo.toml` bin**

```toml
[[bin]]
name = "dev_cache"
path = "src/bin/dev_cache.rs"
```

- [ ] **Step 4: `package.json` script**

```json
"dev:cache-images": "cargo run --manifest-path src-tauri/Cargo.toml --bin dev_cache -- file_image"
```

- [ ] **Step 5: CLI smoke test**

Run from repo root: `pnpm dev:cache-images`  
Expected: creates `.dev-cache/file_image.json`, prints item count.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/dev_cache.rs src-tauri/src/bin/dev_cache.rs src-tauri/src/lib.rs src-tauri/Cargo.toml package.json
git commit -m "feat: dev_cache CLI writes file_image scan to .dev-cache"
```

---

### Task 3: Tauri dev cache commands

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add commands in `commands.rs`**

```rust
#[tauri::command]
pub fn dev_scan_cache_exists(scanner_id: String) -> Result<bool, String> {
    crate::dev_cache::dev_cache_exists(&scanner_id)
}

#[tauri::command]
pub fn read_dev_scan_cache(scanner_id: String) -> Result<ScanCategoryResult, String> {
    crate::dev_cache::read_dev_cache(&scanner_id)
}
```

Register both in `lib.rs` `generate_handler![...]`.

- [ ] **Step 2: Frontend API**

`src/lib/api.ts`:

```typescript
export function devScanCacheExists(scannerId: string) {
  return invoke<boolean>("dev_scan_cache_exists", { scannerId });
}

export function readDevScanCache(scannerId: string) {
  return invoke<ScanCategoryResult>("read_dev_scan_cache", { scannerId });
}
```

- [ ] **Step 3: Build check**

Run: `cd src-tauri && cargo build && pnpm exec tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs src/lib/api.ts
git commit -m "feat: Tauri commands to read dev scan cache from .dev-cache"
```

---

### Task 4: Dev UX — default tab, load cache on open, card hint

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/hooks/useScanSession.ts`
- Modify: `src/hooks/useDetailView.ts`
- Modify: `src/lib/categoryCardCopy.ts`
- Modify: `src/components/CategoryCard.tsx` (if needed for hint prop)

- [ ] **Step 1: Default home tab in dev**

`src/App.tsx`:

```typescript
const [activeHomeTab, setActiveHomeTab] = useState<HomeTab>(
  import.meta.env.DEV ? "file_type" : "classification",
);
```

- [ ] **Step 2: `loadDevScanCache` in `useScanSession`**

Add import `readDevScanCache` from api.

```typescript
  const loadDevScanCache = useCallback(
    async (scannerId: ScannerId): Promise<boolean> => {
      try {
        const category = await readDevScanCache(scannerId);
        setCategories((prev) => {
          const rest = prev.filter((c) => c.scannerId !== scannerId);
          return [...rest, category];
        });
        setScanState((s) => ({ ...s, [scannerId]: "scanned" }));
        setSelectedIdsByCategory((prev) => {
          const set = new Set<string>();
          for (const item of category.items) {
            if (item.selectedByDefault && item.deletable) {
              set.add(item.id);
            }
          }
          return { ...prev, [scannerId]: set };
        });
        return true;
      } catch (e) {
        console.error(e);
        setError(String(e));
        return false;
      }
    },
    [],
  );
```

Return `loadDevScanCache` from hook.

- [ ] **Step 3: Wire `useDetailView`**

Add params: `loadDevScanCache: (id: ScannerId) => Promise<boolean>`.

Replace `handleOpenCategory`:

```typescript
  const handleOpenCategory = useCallback(
    (scannerId: ScannerId) => {
      const open = () => {
        setDetailScannerId(scannerId);
        setView("detail");
      };
      if (import.meta.env.DEV && scannerId === "file_image") {
        void loadDevScanCache(scannerId).finally(open);
        return;
      }
      open();
    },
    [loadDevScanCache],
  );
```

`App.tsx`: pass `loadDevScanCache` into `useDetailView`.

- [ ] **Step 4: Optional card hint — cache exists while unscanned**

In `useScanSession`, on mount in DEV only:

```typescript
  const [devCacheAvailable, setDevCacheAvailable] = useState<Partial<Record<ScannerId, boolean>>>({});
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    devScanCacheExists("file_image")
      .then((exists) => setDevCacheAvailable({ file_image: exists }))
      .catch(console.error);
  }, []);
```

Export `devCacheAvailable`.

Extend `categoryCardSubText`:

```typescript
export function categoryCardSubText(
  scanState: CategoryScanState,
  itemCount: number,
  scannerId: ScannerId,
  devCacheAvailable?: boolean,
): string {
  if (scanState === "unscanned" && devCacheAvailable) {
    return "调试缓存可用";
  }
  // ... existing branches
}
```

Pass `devCacheAvailable={devCacheAvailable[scannerId]}` from `CategoryCard` / `DashboardView`.

- [ ] **Step 5: Manual smoke**

Run: `pnpm dev:cache-images && pnpm tauri:dev`  
Expected: file_type tab; image card shows「调试缓存可用」; open card loads list without scanning spinner.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/hooks/useScanSession.ts src/hooks/useDetailView.ts src/lib/categoryCardCopy.ts src/components/CategoryCard.tsx src/components/DashboardView.tsx
git commit -m "feat: dev default file-type tab and load image cache on open"
```

---

### Task 5: Virtualized `DetailItemList`

**Files:**
- Modify: `package.json`
- Modify: `src/components/DetailItemList.tsx`
- Modify: `src/components/CategoryDetailView.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Install dependency**

Run: `pnpm add @tanstack/react-virtual`

- [ ] **Step 2: Pass scroll container ref**

`App.tsx` detail branch — add ref:

```typescript
  const detailScrollRef = useRef<HTMLDivElement>(null);
```

On the scrolling `Box` (`app-main-scroll`): `ref={detailScrollRef}`.

Pass to `CategoryDetailView`:

```typescript
  scrollRef={detailScrollRef}
```

`CategoryDetailView` passes `scrollRef` to `DetailItemList`.

- [ ] **Step 3: Virtualize rows in `DetailItemList`**

Replace body render with (keep header row non-virtualized):

```typescript
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, type RefObject } from "react";

interface DetailItemListProps {
  scannerId: string;
  items: ScanItem[];
  selectedIds: Set<string>;
  onToggleItem: (itemId: string, checked: boolean) => void;
  scrollRef: RefObject<HTMLElement | null>;
}

export function DetailItemList({ ..., scrollRef }: DetailItemListProps) {
  const rows = useMemo(() => {
    const groups = groupItemsForCategory(scannerId, items);
    return flattenDetailGroups(groups);
  }, [scannerId, items]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) =>
      rows[index]?.kind === "group-header"
        ? DETAIL_GROUP_HEADER_HEIGHT
        : DETAIL_ITEM_ROW_HEIGHT,
    overscan: 12,
  });

  return (
    <Box w="100%">
      {/* column header unchanged */}
      <Box style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index]!;
          return (
            <Box
              key={row.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {row.kind === "group-header" ? (
                <GroupHeaderRow row={row} />
              ) : (
                <ItemRow
                  item={row.item}
                  checked={selectedIds.has(row.item.id)}
                  onToggleItem={onToggleItem}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 4: Verify**

Run: `pnpm test && pnpm build`  
Manual: open image detail with large cache — scroll should stay responsive.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/DetailItemList.tsx src/components/CategoryDetailView.tsx src/App.tsx
git commit -m "feat: virtualize detail item list for large scan results"
```

---

### Task 6: README + final QA

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document dev workflow**

Add section:

```markdown
### 开发：图片扫描调试缓存

1. 在仓库根目录执行 `pnpm dev:cache-images`（写入 `.dev-cache/file_image.json`）
2. 执行 `pnpm tauri:dev`（默认打开「文件类型」Tab）
3. 点击「图片」卡片从缓存加载；可在设置中调整各文件类型的最小扫描体积后重新生成缓存

环境变量 `CLEANMAC_DEV_CACHE_DIR` 可覆盖缓存目录（测试用）。
```

- [ ] **Step 2: Full verification**

Run:

```bash
pnpm test && pnpm build
cd src-tauri && cargo test
pnpm dev:cache-images
```

Manual checklist from spec QA section.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: dev image scan cache workflow"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| CLI `pnpm dev:cache-images` | Task 2 |
| `.dev-cache/file_image.json` + gitignore | Task 2 (gitignore done in spec commit) |
| Dev default file_type tab | Task 4 |
| Load cache on image card open | Task 4 |
| Per-type min bytes settings + scanner | Task 1 |
| Virtual list dev + prod | Task 5 |
| `dev_scan_cache_exists` / `read_dev_scan_cache` | Task 3 |
| `CLEANMAC_DEV_CACHE_DIR` | Task 2 `dev_cache_dir` |
| README | Task 6 |
| Card「调试缓存可用」| Task 4 Step 4 |

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-04-file-type-dev-cache-and-min-size.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement in this session with checkpoints  

Which approach?
