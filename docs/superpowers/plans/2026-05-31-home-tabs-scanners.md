# Home Tabs & Scanner Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sidebar tabs (文件分类 / 文件类型), reorder classification cards, add applications + five file-type scanners, remove duplicate-files feature, and add cache-impact UX on app/dev caches.

**Architecture:** One Rust `Scanner` per card; shared `file_types.rs` walk for extension filtering; frontend `ALL_SCANNER_IDS` drives session state; `activeHomeTab` switches `scannerOrder` and branches one-click scan. Duplicates removed end-to-end from settings, orchestrator, and UI.

**Tech Stack:** Tauri 2, Rust (rayon scanners), React 19, Mantine 7, Vitest (`pnpm test`), `cargo test` in `src-tauri/`.

**Design spec:** `docs/superpowers/specs/2026-05-31-home-tabs-scanners-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src-tauri/src/scan/applications.rs` | List `.app` in `/Applications` + `~/Applications` |
| `src-tauri/src/scan/file_types.rs` | Shared home walk filtered by extension sets |
| `src-tauri/src/scan/duplicates.rs` | **Delete** |
| `src-tauri/src/scan/mod.rs` | Register/remove scanners |
| `src-tauri/src/settings.rs` | Drop duplicate settings fields; sanitize loaded ids |
| `src/lib/categoryMeta.ts` | `CLASSIFICATION_SCANNER_ORDER`, `FILE_TYPE_SCANNER_ORDER`, `ALL_SCANNER_IDS`, meta |
| `src/lib/types.ts` | Slim `AppSettings` |
| `src/lib/scanState.ts` | Init state for all 12 ids |
| `src/lib/cacheImpactCopy.ts` | Static impact text |
| `src/components/HomeSidebar.tsx` | Tab nav |
| `src/components/CacheImpactModal.tsx` | Impact info dialog |
| `src/hooks/useScanSession.ts` | 12-id state; tab-aware `handleScanAll` |
| `src/hooks/useDetailView.ts` | Remove duplicates guard |
| `src/App.tsx` | `AppShell.Navbar`, tab state, wire scan-all |
| `src/components/DashboardView.tsx` | `scannerOrder` prop |
| `src/components/CategoryCard.tsx` |「影响说明」button |
| `src/components/CategoryDetailView.tsx` | Cache Alert; drop duplicates UI |
| `src/components/DeleteConfirmModal.tsx` | Cache warning line |
| `src/components/SettingsPanel.tsx` | 7 classification checkboxes only |

---

### Task 1: Remove duplicate-files backend

**Files:**
- Delete: `src-tauri/src/scan/duplicates.rs`
- Modify: `src-tauri/src/scan/mod.rs`
- Modify: `src-tauri/src/settings.rs`
- Modify: `src-tauri/src/commands.rs` (tests only if they reference duplicates grouping)
- Modify: `src-tauri/src/scan/large_files.rs` (test fixtures using `scan_duplicates`)

- [ ] **Step 1: Remove duplicates module**

In `src-tauri/src/scan/mod.rs`:

- Remove `pub mod duplicates;`
- Remove `Box::new(duplicates::DuplicatesScanner)` from `full()` (and any milestone fn still listing it).

Delete file `src-tauri/src/scan/duplicates.rs`.

- [ ] **Step 2: Slim `Settings` struct**

In `src-tauri/src/settings.rs`, remove fields and defaults:

```rust
// REMOVE: duplicate_min_bytes, scan_duplicates, max_hash_bytes
// and their default_* helpers
pub struct Settings {
    pub large_file_min_bytes: u64,
    pub include_node_modules: bool,
    pub one_click_scan_ids: Vec<String>,
}
```

In `load_settings()`, after `serde_json::from_str`, sanitize:

```rust
let mut settings: Settings = serde_json::from_str(&content).unwrap_or_default();
settings.one_click_scan_ids.retain(|id| id != "duplicates");
```

Update `#[cfg(test)]` module: remove assertions on duplicate fields; keep `one_click_scan_ids` excludes `duplicates` test or replace with `applications` not in defaults.

- [ ] **Step 3: Fix compile errors**

```bash
cd src-tauri && cargo test 2>&1
```

Fix any remaining `scan_duplicates` / `duplicate_min_bytes` in test `ScanContext` builders (e.g. `large_files.rs`, `commands.rs`).

- [ ] **Step 4: Commit**

```bash
git add -A src-tauri/src/scan/ src-tauri/src/settings.rs
git commit -m "refactor(rust): remove duplicate-files scanner and settings"
```

---

### Task 2: `applications` scanner

**Files:**
- Create: `src-tauri/src/scan/applications.rs`
- Modify: `src-tauri/src/scan/mod.rs`

- [ ] **Step 1: Write failing test**

Add to `applications.rs` `#[cfg(test)]`:

```rust
#[test]
fn lists_app_bundles_under_applications_dir() {
    let tmp = tempfile::tempdir().unwrap();
    let apps = tmp.path().join("Applications");
    std::fs::create_dir_all(&apps).unwrap();
    std::fs::create_dir_all(apps.join("Foo.app")).unwrap();
    std::fs::write(apps.join("Foo.app").join("dummy"), b"x").unwrap();

    // Use scanner with ctx.home = tmp.path() but scan path override:
    // Simplest: point home to tmp and create tmp/Applications OR
    // test helper that calls internal collect_apps(apps_path, ...)
}
```

Prefer extracting `collect_apps_in_dir(dir: &Path, scanner_id: &str, items: &mut Vec<ScanItem>, warnings: &mut Vec<String>)` and unit-test that with `tmp/Applications/Foo.app`.

- [ ] **Step 2: Implement scanner**

```rust
pub struct ApplicationsScanner;

impl Scanner for ApplicationsScanner {
    fn id(&self) -> &'static str { "applications" }
    fn name(&self) -> &'static str { "应用程序" }
    fn default_safety(&self) -> SafetyLevel { SafetyLevel::Review }

    fn scan(&self, ctx: &ScanContext) -> Result<ScanCategoryResult, String> {
        let mut items = Vec::new();
        let mut warnings = Vec::new();
        let roots = [
            PathBuf::from("/Applications"),
            ctx.home.join("Applications"),
        ];
        for root in roots {
            if root.is_dir() {
                collect_apps_in_dir(&root, self.id(), &mut items, &mut warnings);
            } else if root == PathBuf::from("/Applications") {
                warnings.push("无法读取 /Applications，请在系统设置中授予完全磁盘访问权限".into());
            }
        }
        items.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
        let total_bytes = items.iter().map(|i| i.size_bytes).sum();
        Ok(ScanCategoryResult { /* ... */ })
    }
}
```

For each `read_dir` entry: if `path.extension().and_then(|s| s.to_str()) == Some("app")` && `path.is_dir()`, `dir_size(&path)` → `make_scan_item` with `file_category`「应用程序」.

- [ ] **Step 3: Register in `full()`**

Insert after `downloads` or per spec order (order in orchestrator does not affect UI; include in `full()`):

```rust
Box::new(applications::ApplicationsScanner),
```

- [ ] **Step 4: Run tests**

```bash
cd src-tauri && cargo test applications -- --nocapture
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/scan/applications.rs src-tauri/src/scan/mod.rs
git commit -m "feat(scan): add applications scanner for .app bundles"
```

---

### Task 3: File-type scanners (`file_types.rs`)

**Files:**
- Create: `src-tauri/src/scan/file_types.rs`
- Modify: `src-tauri/src/scan/mod.rs`

- [ ] **Step 1: Extension sets + failing test**

```rust
pub const VIDEO_EXT: &[&str] = &["mp4", "mov", "mkv", "avi", "wmv", "m4v", "webm"];
// ... AUDIO_EXT, IMAGE_EXT, PDF_EXT, OFFICE_EXT per spec

#[test]
fn matches_extensions_case_insensitive() {
    assert!(ext_matches("file.MP4", VIDEO_EXT));
    assert!(!ext_matches("file.pdf", VIDEO_EXT));
}
```

- [ ] **Step 2: Shared walk**

Copy structure from `large_files.rs` `walk_large_files` but:
- On files (not dirs): if extension in set, push item (no min size).
- Reuse `is_denied`, `is_protected_path`, skip `node_modules` when `!ctx.settings.include_node_modules`.
- Emit progress via `emit_scan_progress` every N files (optional, match large_files pattern).

Five structs:

```rust
pub struct FileVideoScanner;
// id: file_video, name: 视频, extensions: VIDEO_EXT
```

Each calls `walk_file_types(&ctx.home, &ctx.home, ctx, EXT, &mut items, &mut warnings)`.

- [ ] **Step 3: Register all five in `full()`**

- [ ] **Step 4: Run tests**

```bash
cd src-tauri && cargo test file_type -- --nocapture
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/scan/file_types.rs src-tauri/src/scan/mod.rs
git commit -m "feat(scan): add file-type scanners (video/audio/image/pdf/office)"
```

---

### Task 4: Frontend scanner catalog (`categoryMeta`)

**Files:**
- Modify: `src/lib/categoryMeta.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/scanState.ts`
- Modify: `src/hooks/useScanSession.ts` (progress filter id list)

- [ ] **Step 1: Update `categoryMeta.ts`**

```ts
export const CLASSIFICATION_SCANNER_ORDER = [
  "downloads",
  "trash",
  "applications",
  "app_caches",
  "dev_caches",
  "logs",
  "large_files",
] as const;

export const FILE_TYPE_SCANNER_ORDER = [
  "file_video",
  "file_audio",
  "file_image",
  "file_pdf",
  "file_office",
] as const;

export type ClassificationScannerId = (typeof CLASSIFICATION_SCANNER_ORDER)[number];
export type FileTypeScannerId = (typeof FILE_TYPE_SCANNER_ORDER)[number];
export type ScannerId = ClassificationScannerId | FileTypeScannerId;

export const ALL_SCANNER_IDS: ScannerId[] = [
  ...CLASSIFICATION_SCANNER_ORDER,
  ...FILE_TYPE_SCANNER_ORDER,
];

export const FILE_TYPE_ONE_CLICK_IDS: FileTypeScannerId[] = [...FILE_TYPE_SCANNER_ORDER];

// SCANNER_META: add applications (IconApps), file_* icons (IconVideo, IconMusic, IconPhoto, IconFileTypePdf, IconFileSpreadsheet or similar)
// Remove duplicates entry and IconCopy import if unused
// mergeCategories(order: readonly ScannerId[], results: ScanCategoryResult[])
```

Keep `DEFAULT_ONE_CLICK_SCAN_IDS` as classification subset without `applications` / `large_files`.

- [ ] **Step 2: Slim `AppSettings` in `types.ts`**

```ts
export interface AppSettings {
  largeFileMinBytes: number;
  includeNodeModules: boolean;
  oneClickScanIds: string[];
}
```

- [ ] **Step 3: `scanState.ts` uses `ALL_SCANNER_IDS`**

```ts
import { ALL_SCANNER_IDS, type ScannerId } from "./categoryMeta";

export function initialScanState(): Record<ScannerId, CategoryScanState> {
  return Object.fromEntries(
    ALL_SCANNER_IDS.map((id) => [id, "unscanned" as CategoryScanState]),
  ) as Record<ScannerId, CategoryScanState>;
}
```

- [ ] **Step 4: `useScanSession` empty selections + progress**

Replace `SCANNER_ORDER` with `ALL_SCANNER_IDS` in:
- `emptySelectedIdsByCategory`
- progress listener: `ALL_SCANNER_IDS.includes(id)`

- [ ] **Step 5: Vitest for orders**

Create `src/lib/categoryMeta.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CLASSIFICATION_SCANNER_ORDER, FILE_TYPE_SCANNER_ORDER } from "./categoryMeta";

it("classification order matches spec", () => {
  expect(CLASSIFICATION_SCANNER_ORDER[0]).toBe("downloads");
  expect(CLASSIFICATION_SCANNER_ORDER).not.toContain("duplicates");
  expect(CLASSIFICATION_SCANNER_ORDER).toHaveLength(7);
});

it("file type order has five scanners", () => {
  expect(FILE_TYPE_SCANNER_ORDER).toHaveLength(5);
});
```

Run: `pnpm test src/lib/categoryMeta.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/lib/categoryMeta.ts src/lib/types.ts src/lib/scanState.ts src/hooks/useScanSession.ts src/lib/categoryMeta.test.ts
git commit -m "feat(ui): expand scanner ids for classification and file types"
```

---

### Task 5: Remove duplicates from frontend

**Files:**
- Modify: `src/hooks/useDetailView.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/SettingsPanel.tsx`
- Delete or trim: `src/lib/scanGuardCopy.ts` (if only duplicates copy)
- Modify: `src/lib/groupScanItems.ts`
- Modify: `src/components/CategoryDetailView.tsx`
- Modify: `src/lib/slowScanConfirmCopy.ts`

- [ ] **Step 1: `useDetailView`**

Remove `duplicatesDisabledOpen` state, guard block for `duplicates`, return fields, and `DUPLICATES_DISABLED_CONFIRM` import.

- [ ] **Step 2: `App.tsx`**

Remove second `ScanConfirmModal` for duplicates disabled.

- [ ] **Step 3: `SettingsPanel`**

Remove rows: 重复文件最小大小, 扫描重复文件, 重复文件哈希上限.

Change one-click checkboxes to `CLASSIFICATION_SCANNER_ORDER.map(...)`.

- [ ] **Step 4: `groupScanItems` / `CategoryDetailView`**

Remove `duplicates`-specific grouping/UI branches.

- [ ] **Step 5: Typecheck**

```bash
pnpm build
```

Expected: success (fix any remaining `scanDuplicates` references)

- [ ] **Step 6: Commit**

```bash
git commit -am "refactor(ui): remove duplicate-files settings and guards"
```

---

### Task 6: Tab-aware one-click scan

**Files:**
- Modify: `src/hooks/useScanSession.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Export tab type**

In `src/lib/homeTab.ts` (new):

```ts
export type HomeTab = "classification" | "file_type";
export const FILE_TYPE_ONE_CLICK_IDS = /* re-export from categoryMeta or define once */;
```

- [ ] **Step 2: Update `handleScanAll`**

```ts
const handleScanAll = useCallback(
  (appSettings: AppSettings | null, activeTab: HomeTab) => {
    if (activeTab === "file_type") {
      void runScan([...FILE_TYPE_SCANNER_ORDER]);
      return;
    }
    const ids = (
      appSettings?.oneClickScanIds?.length
        ? appSettings.oneClickScanIds.filter((id): id is ScannerId =>
            (CLASSIFICATION_SCANNER_ORDER as readonly string[]).includes(id),
          )
        : DEFAULT_ONE_CLICK_SCAN_IDS
    ) as ScannerId[];
    void runScan(ids);
  },
  [runScan],
);
```

- [ ] **Step 3: `App.tsx` state + caller**

```tsx
const [activeHomeTab, setActiveHomeTab] = useState<HomeTab>("classification");
// DashboardHeader onScanAll={() => handleScanAll(appSettings, activeHomeTab)}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/homeTab.ts src/hooks/useScanSession.ts src/App.tsx
git commit -m "feat(scan): branch one-click scan by home tab"
```

---

### Task 7: Sidebar navigation + dashboard grid

**Files:**
- Create: `src/components/HomeSidebar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/DashboardView.tsx`

- [ ] **Step 1: `HomeSidebar`**

```tsx
import { NavLink, Stack, Text } from "@mantine/core";

interface HomeSidebarProps {
  activeTab: HomeTab;
  onTabChange: (tab: HomeTab) => void;
}

export function HomeSidebar({ activeTab, onTabChange }: HomeSidebarProps) {
  return (
    <Stack gap="xs" p="sm">
      <Text size="xs" c="dimmed" fw={600}>浏览</Text>
      <NavLink
        label="文件分类"
        active={activeTab === "classification"}
        onClick={() => onTabChange("classification")}
      />
      <NavLink
        label="文件类型"
        active={activeTab === "file_type"}
        onClick={() => onTabChange("file_type")}
      />
    </Stack>
  );
}
```

- [ ] **Step 2: `App.tsx` AppShell**

```tsx
<AppShell navbar={{ width: 120, breakpoint: "sm" }}>
  <AppShell.Navbar p={0}>
    <HomeSidebar activeTab={activeHomeTab} onTabChange={setActiveHomeTab} />
  </AppShell.Navbar>
  ...
  <DashboardView
    scannerOrder={
      activeHomeTab === "classification"
        ? CLASSIFICATION_SCANNER_ORDER
        : FILE_TYPE_SCANNER_ORDER
    }
    ...
  />
</AppShell>
```

Ensure `MacWindowTitleBar` + main padding still align (may need `AppShell` `padding` adjustment).

- [ ] **Step 3: `DashboardView`**

```tsx
interface DashboardViewProps {
  scannerOrder: readonly ScannerId[];
  // ...existing
}

// Replace SCANNER_ORDER.map with scannerOrder.map
```

- [ ] **Step 4: Manual smoke**

`pnpm tauri:dev` — switch tabs; card counts 7 vs 5; scanned badge persists across tab switch.

- [ ] **Step 5: Commit**

```bash
git add src/components/HomeSidebar.tsx src/App.tsx src/components/DashboardView.tsx
git commit -m "feat(ui): add home sidebar tabs for classification and file types"
```

---

### Task 8: Cache impact UX

**Files:**
- Create: `src/lib/cacheImpactCopy.ts`
- Create: `src/components/CacheImpactModal.tsx`
- Modify: `src/components/CategoryCard.tsx`
- Modify: `src/components/CategoryDetailView.tsx`
- Modify: `src/components/DeleteConfirmModal.tsx`
- Modify: `src/App.tsx` or `DashboardView.tsx` (modal state)

- [ ] **Step 1: Copy constants**

```ts
export const CACHE_IMPACT_COPY = {
  app_caches: {
    title: "应用缓存 — 删除影响",
    body: "浏览器、聊天与影音应用的缓存删除后会在使用时重新生成，首次打开可能变慢。部分游戏会重新下载资源包。",
  },
  dev_caches: {
    title: "开发缓存 — 删除影响",
    body: "Xcode DerivedData 删除后需完整重新编译。npm/cargo 等包管理缓存删除后需重新下载依赖，离线环境可能暂时无法构建。",
  },
} as const;
```

- [ ] **Step 2: `CacheImpactModal`**

Thin wrapper: `Modal` + `cleanMacModalProps` + `title` + `Text` +「知道了」button.

- [ ] **Step 3: `CategoryCard` impact button**

For `scannerId === "app_caches" | "dev_caches"`, render `Button variant="subtle" size="compact-xs"`「影响说明」with `e.stopPropagation()` on click; call `onShowCacheImpact(scannerId)`.

Wire state in `DashboardView`:

```tsx
const [cacheImpactId, setCacheImpactId] = useState<"app_caches" | "dev_caches" | null>(null);
```

- [ ] **Step 4: Detail `Alert`**

In `CategoryDetailView`, when scanner is app/dev caches:

```tsx
const [alertDismissed, setAlertDismissed] = useState(false);
// useEffect reset when scannerId changes
{!alertDismissed && (
  <Alert variant="light" color="yellow" withCloseButton onClose={() => setAlertDismissed(true)}>
    删除缓存可能导致应用重新加载数据或开发环境需重新构建。
  </Alert>
)}
```

- [ ] **Step 5: `DeleteConfirmModal`**

Add optional prop `extraWarning?: string`; when category is app/dev caches pass one sentence from copy.

- [ ] **Step 6: Commit**

```bash
git add src/lib/cacheImpactCopy.ts src/components/CacheImpactModal.tsx src/components/CategoryCard.tsx src/components/CategoryDetailView.tsx src/components/DeleteConfirmModal.tsx src/components/DashboardView.tsx
git commit -m "feat(ui): cache impact modal and delete warnings"
```

---

### Task 9: Permissions & slow-scan polish

**Files:**
- Modify: `src/lib/scanState.ts` (optional `applications` permission heuristic)
- Modify: `src/lib/slowScanConfirmCopy.ts`
- Modify: `src-tauri/src/commands.rs` (if delete grouping still references duplicates)

- [ ] **Step 1: Applications permission**

If `applications` category has warning containing `/Applications`, set scan state `needs_permission` in `scanStateAfterResult` (similar to trash warnings):

```ts
if (scannerId === "applications" && category.warnings.some((w) => w.includes("/Applications"))) {
  return "needs_permission";
}
```

- [ ] **Step 2: Slow scan confirm**

Remove `duplicates` from `SLOW_SCAN_CONFIRM`. Optionally add `applications: { title, body }` if listing `/Applications` is slow (YAGNI: skip unless UX asks).

- [ ] **Step 3: `commands.rs`**

Remove duplicates-only delete grouping branches; use generic grouping for all review categories.

- [ ] **Step 4: `cargo test && pnpm build`**

- [ ] **Step 5: Commit**

```bash
git commit -am "fix: applications permission state and post-duplicates cleanup"
```

---

### Task 10: README & docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update feature bullets**

Remove duplicate files; add:

- Applications (.app) cleanup
- File-type tab (video, audio, image, PDF, Office)
- Sidebar 文件分类 / 文件类型

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for tabs and new scanners"
```

---

## Verification checklist

- [ ] `cd src-tauri && cargo test` — all pass
- [ ] `pnpm test && pnpm build` — pass
- [ ] 文件分类: 7 cards in spec order; no 重复文件
- [ ] 文件类型: 5 cards; one-click scans all 5
- [ ] 文件分类 one-click respects settings checkboxes
- [ ] Tab switch keeps scan badges and selections
- [ ] 应用缓存/开发缓存: 影响说明 modal + detail alert + delete warning
- [ ] Settings: no duplicate fields; 7 checkboxes only
- [ ] `/Applications` unreadable → 应用程序 needs permission banner path

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Sidebar tabs | Task 7 |
| Classification order + remove duplicates | Task 1, 4, 5, 7 |
| Applications scanner | Task 2 |
| File-type scanners + extensions | Task 3 |
| Tab scan-all behavior | Task 6 |
| Settings migration | Task 1, 5 |
| Cache impact C (modal + detail + delete) | Task 8 |
| State preserved across tabs | Task 4, 7 |
| README | Task 10 |

No TBD placeholders in plan steps.
