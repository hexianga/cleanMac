# Dashboard Card Shadow Clip Fix — Implementation Plan

> **For agentic workers:** Use executing-plans or implement directly (single task).

**Goal:** Prevent last-row card hover shadows from being clipped by the dashboard `ScrollArea`.

**Architecture:** One padded wrapper inside `ScrollArea`; constant 32px bottom inset matches `0 8px 24px` shadow.

**Design spec:** `docs/superpowers/specs/2026-05-31-dashboard-card-shadow-clip-design.md`

---

### Task 1: Scroll content padding

**Files:**
- Modify: `src/components/DashboardView.tsx`

- [ ] **Step 1:** Add constant `DASHBOARD_GRID_SHADOW_PADDING_PX = 32`

- [ ] **Step 2:** Wrap both tab `Box` children in:

```tsx
<Box style={{ paddingBottom: DASHBOARD_GRID_SHADOW_PADDING_PX }}>
  {/* classification + file_type grids */}
</Box>
```

- [ ] **Step 3:** Change `CategoryCardGrid` `Grid` from `pb="xs"` to no bottom padding

- [ ] **Step 4:** Manual QA — hover last row without scrolling; `npm run build`
