# Detail View Scroll Fix Implementation Plan

> **For agentic workers:** Use executing-plans or implement directly (single task).

**Goal:** Restore scrolling in the category detail item list while keeping top chrome fixed.

**Architecture:** Propagate bounded height through `AppShell.Main` → detail `Box` → `CategoryDetailView` → `VirtualDetailItemList`; only the virtual list inner viewport uses `overflow: auto`.

**Design spec:** `docs/superpowers/specs/2026-05-31-detail-scroll-fix-design.md`

---

### Task 1: Scroll content padding

**Files:**
- Modify: `src/components/DashboardView.tsx` (separate work)
- Modify: `src/App.tsx`, `CategoryDetailView.tsx`, `VirtualDetailItemList.tsx`

See design spec for detail scroll layout tasks.
