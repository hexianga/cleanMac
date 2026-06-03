# Post-Delete Disk Overview Refresh Design

**Status:** Approved (2026-06-03)  
**Context:** After a successful delete from category detail, the app rescans that category but does not refresh the homepage disk card (`DashboardHeader`). Disk data is loaded once on startup via `useAppBootstrap` → `get_disk_overview`.

## Goal

When the user confirms delete and **at least one item succeeds**, re-fetch the Mac root volume available space and update the dashboard header card. No refresh on total failure or when the user only opens the delete dialog without confirming.

## Non-goals

- Optimistic UI that adjusts `availableBytes` from deleted item sizes
- Showing disk stats on the detail view
- Backend changes to `delete_items`
- Polling disk space on an interval
- Refreshing disk on window focus (existing behavior is permission refresh only)

## Chosen approach

**Frontend refresh via existing `get_disk_overview` command** (not bundling disk into `delete_items`).

| Alternative | Why not chosen |
|-------------|----------------|
| Return `DiskOverview` from `delete_items` | Couples delete IPC to disk query; duplicate logic if more delete entry points appear |
| Optimistic delta from `sizeBytes` | Wrong when files go to Trash; `statfs` does not always reflect trashed bytes as freed |

## Trigger rules

| Event | Refresh disk? |
|-------|----------------|
| Delete confirm, `succeeded.length > 0` | Yes |
| Delete confirm, all failed | No |
| Delete throws before results | No |
| Partial success | Yes |

## Data flow

```
handleConfirmDelete
  → delete_items
  → if succeeded.length > 0:
       Promise.all([
         refreshDisk(),           // get_disk_overview → setDisk
         runScan([detailScannerId]) // unchanged
       ])
```

- `refreshDisk` failures: log to console only; do not block rescan or surface a new user-facing error (header keeps last known values).
- Parallel execution avoids delaying disk card update until category scan finishes.

## Implementation

| File | Change |
|------|--------|
| `src/hooks/useAppBootstrap.ts` | Extract `refreshDisk(): Promise<void>`; call on mount as today |
| `src/App.tsx` | Pass `refreshDisk` into `useDetailView` |
| `src/hooks/useDetailView.ts` | On success branch, `Promise.all([refreshDisk(), runScan(...)])` |

No Rust changes.

## UI

- `DashboardHeader` continues to receive `disk` from `App`; no new loading state on the disk card.
- User may delete while on detail view; returning to dashboard shows updated disk data without extra action.

## macOS behavior note

Deletes use `trash::delete` (move to Trash), not immediate permanent removal. `statfs` on `/` often **does not increase `f_bavail` significantly** when files are only trashed; clearing Trash (`empty_trash`) or permanent deletes should show a clearer change. Refresh still reflects real system state and avoids misleading optimistic numbers.

## QA

- [ ] Delete one deletable item successfully → return to dashboard → disk card reflects latest `get_disk_overview` (may be unchanged if only trashed)
- [ ] Empty Trash category (all items, full empty) → available space increases if system reports it
- [ ] All selected items fail → disk card unchanged from before attempt
- [ ] Partial success → disk refresh runs; category rescan runs
- [ ] `pnpm test` and `pnpm build` pass

## Risks

| Risk | Mitigation |
|------|------------|
| User expects immediate “+X GB” after trashing | Documented limitation; no fake optimistic UI |
| Race: stale disk if `refreshDisk` fails silently | Acceptable; rare; next app launch refreshes |
