# Settings Panel & Duplicates Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Horizontal settings form rows, save-to-close with title-bar X, and a blocking modal when scanning duplicates while「扫描重复文件」is off in settings.

**Architecture:** Add `SettingsFieldRow` for label/control alignment; update `SettingsPanel` save/close flow without `cleanMacModalProps` (needs `withCloseButton`). Add `DUPLICATES_DISABLED_CONFIRM` copy and guard in `useDetailView` before `runScan`; wire second `ScanConfirmModal` in `App.tsx` with「去设置」opening settings.

**Tech Stack:** React 19, Mantine 7, Tauri 2, Vitest (existing frontend tests only if added).

**Design spec:** `docs/design/2026-05-31-settings-panel-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src/components/SettingsFieldRow.tsx` | Grid row: label left, control right |
| `src/components/SettingsPanel.tsx` | Form layout, save→`onClose`, `withCloseButton` |
| `src/lib/scanGuardCopy.ts` | `DUPLICATES_DISABLED_CONFIRM` constant |
| `src/hooks/useDetailView.ts` | Duplicates-disabled guard + modal state |
| `src/App.tsx` | Pass `appSettings`, wire duplicates modal |

No Rust changes required (backend fallback already exists).

---

### Task 1: `SettingsFieldRow` component

**Files:**
- Create: `src/components/SettingsFieldRow.tsx`

- [ ] **Step 1: Create `SettingsFieldRow`**

```tsx
import { Grid } from "@mantine/core";
import type { ReactNode } from "react";

interface SettingsFieldRowProps {
  label: ReactNode;
  children: ReactNode;
}

export function SettingsFieldRow({ label, children }: SettingsFieldRowProps) {
  return (
    <Grid align="center" gutter="sm">
      <Grid.Col span={{ base: 12, sm: 5 }}>{label}</Grid.Col>
      <Grid.Col span={{ base: 12, sm: 7 }}>{children}</Grid.Col>
    </Grid>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SettingsFieldRow.tsx
git commit -m "feat(ui): add SettingsFieldRow for horizontal settings labels"
```

---

### Task 2: Refactor `SettingsPanel` layout and save/close

**Files:**
- Modify: `src/components/SettingsPanel.tsx`

- [ ] **Step 1: Update imports**

Add `SettingsFieldRow`. Remove `saved` state and success `Text` block.

- [ ] **Step 2: Enable title-bar close**

Change `Modal` props:

```tsx
<Modal
  opened={opened}
  onClose={onClose}
  title="扫描设置"
  centered
  withCloseButton
  transitionProps={{ transition: "fade-down", duration: 200, timingFunction: "ease" }}
  overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
>
```

Do **not** spread `cleanMacModalProps` (it sets `withCloseButton: false`).

- [ ] **Step 3: Wrap fields in `SettingsFieldRow`**

Example for large file threshold:

```tsx
<SettingsFieldRow
  label={
    <FieldLabel
      label="大文件阈值（MB）"
      tooltip="超过此大小的文件会出现在「大文件」类别"
    />
  }
>
  <NumberInput
    min={1}
    data-autofocus
    value={Math.round(settings.largeFileMinBytes / MB)}
    onChange={(value) => { /* existing logic */ }}
  />
</SettingsFieldRow>
```

Repeat for duplicate min, scan duplicates switch, max hash, node_modules switch.

Set `disabled={!settings.scanDuplicates}` on duplicate min and max hash `NumberInput`s.

- [ ] **Step 4: Close on successful save**

In `handleSave`, after `await saveSettings(settings)` and `onSaved?.(settings)`:

```tsx
onClose();
```

Remove `setSaved(true)` and the `saved && (...)` teal message.

- [ ] **Step 5: Remove unused `saved` state**

Delete `const [saved, setSaved] = useState(false)` and all `setSaved(false)` calls in onChange handlers.

- [ ] **Step 6: Manual check**

Run: `pnpm tauri:dev`  
Verify: labels and inputs on one row (sm+ width); X and「关闭」discard edits;「保存」closes modal.

- [ ] **Step 7: Commit**

```bash
git add src/components/SettingsPanel.tsx
git commit -m "feat(settings): horizontal rows, save closes modal, title close icon"
```

---

### Task 3: Duplicates-disabled copy constant

**Files:**
- Create: `src/lib/scanGuardCopy.ts`

- [ ] **Step 1: Add copy file**

```ts
import type { SlowScanConfirmCopy } from "./slowScanConfirmCopy";

export const DUPLICATES_DISABLED_CONFIRM: SlowScanConfirmCopy = {
  title: "重复文件扫描已关闭",
  body: "请在「扫描设置」中开启「扫描重复文件」后再扫描。",
  confirmLabel: "去设置",
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/scanGuardCopy.ts
git commit -m "feat(copy): add duplicates-disabled scan guard text"
```

---

### Task 4: Guard duplicates scan in `useDetailView`

**Files:**
- Modify: `src/hooks/useDetailView.ts`

- [ ] **Step 1: Extend hook signature**

Add parameters after `onTrashNeedsPermission`:

```ts
appSettings: AppSettings | null,
onOpenSettings: () => void,
```

Import `AppSettings` from `../lib/types`.

- [ ] **Step 2: Add modal state**

```ts
const [duplicatesDisabledOpen, setDuplicatesDisabledOpen] = useState(false);
```

- [ ] **Step 3: Guard in `handleScanCategory`**

Insert **before** `slowScanConfirmFor` check:

```ts
if (scannerId === "duplicates" && appSettings && !appSettings.scanDuplicates) {
  setDuplicatesDisabledOpen(true);
  return;
}
```

Update `useCallback` deps: add `appSettings`.

- [ ] **Step 4: Export handlers for App**

Return from hook:

```ts
duplicatesDisabledOpen,
setDuplicatesDisabledOpen,
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDetailView.ts
git commit -m "feat(scan): block duplicates scan when disabled in settings"
```

---

### Task 5: Wire modals in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Pass new args to `useDetailView`**

```tsx
const detail = useDetailView(
  categories,
  selectedIdsByCategory,
  setSelectedIdsByCategory,
  permissionStatus,
  runScan,
  setError,
  () => setPermissionModalOpen(true),
  appSettings,
  () => setSettingsOpen(true),
);
```

- [ ] **Step 2: Add duplicates `ScanConfirmModal`**

Below the slow-scan modal:

```tsx
<ScanConfirmModal
  opened={detail.duplicatesDisabledOpen}
  onClose={() => detail.setDuplicatesDisabledOpen(false)}
  onConfirm={() => {
    detail.setDuplicatesDisabledOpen(false);
    setSettingsOpen(true);
  }}
  copy={DUPLICATES_DISABLED_CONFIRM}
/>
```

Import `DUPLICATES_DISABLED_CONFIRM` from `./lib/scanGuardCopy`.

- [ ] **Step 3: Manual verification**

With「扫描重复文件」off in settings:
1. Click scan on「重复文件」card → modal appears, no scan spinner.
2.「取消」→ modal closes, no scan.
3.「去设置」→ settings modal opens.

With switch on → scan proceeds (or slow-scan rules if any).

- [ ] **Step 4: Run tests**

```bash
pnpm test
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all pass (no new tests required by spec).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): wire duplicates-disabled confirm and settings shortcut"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Horizontal label + input | Task 1–2 |
| Disable duplicate fields when switch off | Task 2 |
| Save closes modal | Task 2 |
| Footer close + X discard edits | Task 2 (`onClose` reloads on reopen via `useEffect`) |
| `withCloseButton` | Task 2 |
| Duplicates scan blocked + modal | Task 3–5 |
|「去设置」opens settings | Task 5 |
| Remove「已保存」inline text | Task 2 |
| Backend fallback unchanged | N/A (no task) |

## Out of scope (do not implement)

- Unsaved-changes confirm on close
- Auto-enable `scanDuplicates` from guard modal
- Filtering `duplicates` out of one-click scan when disabled (optional future)
