# Button Emphasis by Action Design

**Date:** 2026-06-04  
**Status:** Approved  
**Related:** `docs/superpowers/specs/2026-06-04-glass-control-theme-design.md`

## Problem

After scanning, category cards show「重扫」but the scan button still uses `variant="light"`, identical to the pre-scan「扫描」state. Detail actions「全选可删」「清理所选」and「取消全选」also lack a clear visual hierarchy. Users cannot tell primary vs secondary actions at a glance.

## Goals

Apply emphasis level **A** (by operation importance):

| Level | Meaning | Buttons |
|-------|---------|---------|
| Strong | Guide first-time scan | Category「扫描」 |
| Medium | Common primary actions in detail |「全选可删」「清理所选」; dashboard「开始扫描」 stays `filled` |
| Muted | Secondary / repeat actions | Category「重扫」「重试」; detail「取消全选」 |

All styles remain glass-outline, consistent with `control` tokens.

## Non-goals

- New Mantine custom variant names (`scan`, `rescan`, etc.)
- Changing modal, settings, or subtle text buttons
- Scan/delete business logic

## Approach

**Recommended:** Reuse existing Mantine variants (`filled`, `light`, `default`) + tune `control` token contrast + switch variant in components by state/label.

Do not rely on label text alone in CSS; bind `variant` explicitly in JSX from `scanState` / `hasItems`.

## Token adjustments (`cleanMacTheme.ts`)

Refine three button backgrounds for clearer steps (exact rgba may be tuned in implementation):

| Token | Role | Direction |
|-------|------|-----------|
| `buttonBgFilled` | Strong | Slightly more visible indigo glass (scan CTA) |
| `buttonBgLight` | Medium | Keep readable on dark; used for bulk select / clean |
| `buttonBgDefault` | Muted | More transparent / weaker border than `light` |

Hover states stay proportional; no saturated solid fills.

## Component mapping

### `CategoryCard.tsx`

Derive `scanButtonVariant` from scan state (not from label string):

```text
scanState === "unscanned" && !hasItems  →  variant="filled"   (label「扫描」)
otherwise (重扫 / 重试 / scanning done)  →  variant="default"  (label「重扫」or「重试」)
```

Keep `size="xs"`, `disabled` when scanning or permission-blocked. Optional: `loading` when `scanState === "scanning"` (only if already supported elsewhere).

### `CategoryDetailView.tsx`

| Button | variant |
|--------|---------|
| 全选可删 | `light` |
| 取消全选 | `default` |

### `DetailFooter.tsx`

| Button | variant |
|--------|---------|
| 清理所选 | `light` |

「清理所选」and「全选可删」are the same medium tier.

### `DashboardHeader.tsx`

No variant change:「开始扫描」remains `filled` (already strong). Benefits from shared token tuning only.

## Files

| File | Change |
|------|--------|
| `src/lib/cleanMacTheme.ts` | Tune `buttonBgFilled`, `buttonBgLight`, `buttonBgDefault` |
| `src/components/CategoryCard.tsx` | `scanButtonVariant` by state |
| `src/components/CategoryDetailView.tsx` | Confirm variants (likely no label change) |
| `src/components/DetailFooter.tsx` | Confirm `light` on clean button |

## Testing

- `pnpm build` passes.
- Manual:
  - [ ] Unscanned card:「扫描」visually stronger than scanned card「重扫」
  - [ ] Detail:「全选可删」「清理所选」brighter than「取消全选」
  - [ ] Dashboard「开始扫描」still prominent
  - [ ] Disabled/loading scan button readable

## Risks

| Risk | Mitigation |
|------|------------|
| `default` too invisible on cards | Tune `buttonBgDefault`; keep border |
| Error「重试」same as「重扫」 | Both use `default` (intentional secondary) |

## Success criteria

Users can distinguish first scan vs rescan on cards, and primary detail actions vs cancel, without reading every label.
