# Post-Delete Disk Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After at least one successful delete from category detail, refresh `DiskOverview` so the homepage `DashboardHeader` shows current available space.

**Architecture:** Expose `refreshDisk()` from `useAppBootstrap` (wraps existing `get_disk_overview` IPC). Pass it into `useDetailView` and call it in parallel with `runScan` inside the existing `succeeded.length > 0` branch. No Rust changes.

**Tech Stack:** React hooks, Tauri `invoke`, Vitest (existing lib tests only), TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-03-post-delete-disk-refresh-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src/hooks/useAppBootstrap.ts` | Owns `disk` state; provides `refreshDisk` callback |
| `src/App.tsx` | Wires `refreshDisk` into `useDetailView` |
| `src/hooks/useDetailView.ts` | Calls `refreshDisk` after partial/full delete success |

No new files. No backend changes.

---

### Task 1: `refreshDisk` in `useAppBootstrap`

**Files:**
- Modify: `src/hooks/useAppBootstrap.ts`

- [ ] **Step 1: Add `useCallback` import and `refreshDisk`**

Replace the file contents with:

```typescript
import { useCallback, useEffect, useState } from "react";
import { getDiskOverview, getSettings } from "../lib/api";
import type { AppSettings, DiskOverview } from "../lib/types";

export function useAppBootstrap(refreshPermissions: () => Promise<unknown>) {
  const [disk, setDisk] = useState<DiskOverview | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  const refreshDisk = useCallback(async () => {
    try {
      const overview = await getDiskOverview();
      setDisk(overview);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    refreshDisk().catch(console.error);
    getSettings().then(setAppSettings).catch(console.error);
    refreshPermissions().catch(console.error);
  }, [refreshDisk, refreshPermissions]);

  useEffect(() => {
    const onFocus = () => {
      refreshPermissions().catch(console.error);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshPermissions]);

  return { disk, appSettings, setAppSettings, refreshDisk };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`  
Expected: no errors (or only pre-existing unrelated errors).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAppBootstrap.ts
git commit -m "feat: expose refreshDisk from app bootstrap hook"
```

---

### Task 2: Wire `refreshDisk` through `App` and `useDetailView`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/hooks/useDetailView.ts`

- [ ] **Step 1: Destructure `refreshDisk` in `App.tsx`**

Change:

```typescript
const { disk, appSettings, setAppSettings } = useAppBootstrap(refreshPermissions);
```

To:

```typescript
const { disk, appSettings, setAppSettings, refreshDisk } =
  useAppBootstrap(refreshPermissions);
```

- [ ] **Step 2: Pass `refreshDisk` into `useDetailView`**

Change the `useDetailView(` call to add the last argument:

```typescript
const detail = useDetailView(
  categories,
  selectedIdsByCategory,
  setSelectedIdsByCategory,
  permissionStatus,
  runScan,
  setError,
  openPermissionModal,
  refreshDisk,
);
```

- [ ] **Step 3: Extend `useDetailView` signature**

In `src/hooks/useDetailView.ts`, add parameter after `onPermissionRequired`:

```typescript
export function useDetailView(
  categories: ScanCategoryResult[],
  selectedIdsByCategory: Record<ScannerId, Set<string>>,
  setSelectedIdsByCategory: React.Dispatch<
    React.SetStateAction<Record<ScannerId, Set<string>>>
  >,
  permissionStatus: PermissionStatus | null,
  runScan: (scannerIds: ScannerId[]) => Promise<void>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  onPermissionRequired: (variant: PermissionCopyVariant) => void,
  refreshDisk: () => Promise<void>,
) {
```

- [ ] **Step 4: Parallel refresh + rescan on delete success**

In `handleConfirmDelete`, replace:

```typescript
        setDeleteConfirmOpen(false);
        await runScan([detailScannerId]);
```

With:

```typescript
        setDeleteConfirmOpen(false);
        await Promise.all([
          refreshDisk(),
          runScan([detailScannerId]),
        ]);
```

- [ ] **Step 5: Add `refreshDisk` to `handleConfirmDelete` dependency array**

Append `refreshDisk` to the `useCallback` deps at the bottom of `handleConfirmDelete`:

```typescript
  }, [
    detailScannerId,
    detailSelectedIds,
    refreshDisk,
    runScan,
    selectedCount,
    setError,
    setSelectedIdsByCategory,
  ]);
```

- [ ] **Step 6: Typecheck**

Run: `pnpm exec tsc --noEmit`  
Expected: PASS (no missing-arg errors for `useDetailView`).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/hooks/useDetailView.ts
git commit -m "feat: refresh disk overview after successful delete"
```

---

### Task 3: Verify

**Files:** none (commands + manual QA)

- [ ] **Step 1: Run automated checks**

Run: `pnpm test && pnpm build`  
Expected: all tests pass; Vite build succeeds.

- [ ] **Step 2: Manual QA in `pnpm tauri dev`**

1. Note homepage disk card values (可用 X / Y).
2. Open a category with deletable items, select one, 清理所选 → confirm.
3. Return to dashboard — disk card should reflect a fresh `get_disk_overview` call (value may be unchanged if files only moved to Trash; that is expected per spec).
4. Optional: empty Trash category with all items selected — available space should update if macOS reports freed bytes.
5. Force all-fail delete (e.g. protected path if reproducible) — disk card unchanged.

- [ ] **Step 3: Commit (only if doc/checklist updates needed)**

No commit required if Step 1–2 pass with no extra file changes.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Refresh only if `succeeded.length > 0` | Task 2 Step 4 (inside existing branch) |
| No refresh on total failure | Unchanged branch structure |
| `refreshDisk` errors logged, not user-facing | Task 1 `refreshDisk` try/catch |
| Parallel with `runScan` | Task 2 `Promise.all` |
| No Rust / no optimistic UI | File map |
| No disk loading state | No UI tasks |
| QA checklist | Task 3 Step 2 |

## Risks (unchanged from spec)

Trashing files may not increase `f_bavail`; do not “fix” with optimistic math.
