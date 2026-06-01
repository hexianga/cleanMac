# Dashboard Card Hover Shadow Clip Fix

**Status:** Approved (2026-05-31)  
**Problem:** Last row category cards lose the bottom portion of hover `box-shadow` when the grid fits without scrolling (shadow clipped by `ScrollArea` viewport).

## Cause

`CategoryCard` applies `box-shadow: 0 8px 24px rgba(0,0,0,0.35)` on hover. Mantine `ScrollArea` viewport uses `overflow: hidden`. Grid bottom padding (`pb="xs"`) is smaller than the shadow extent (~32px vertical bleed).

## Solution

Add **32px** `padding-bottom` on a single wrapper inside `ScrollArea` around both tab grids. Remove redundant small grid `pb` to avoid double spacing.

## Files

| File | Change |
|------|--------|
| `src/components/DashboardView.tsx` | Wrapper `Box` with `paddingBottom: 32` inside `ScrollArea`; grid `pb` removed |

## Out of scope

- Hover style changes on `CategoryCard`
- `overflow: visible` on scroll viewport
- Detail view / sidebar

## QA

- [ ] Last row hover: full shadow visible without scrolling
- [ ] Scrollable grid: last row at scroll end still shows full shadow
- [ ] Both home tabs
- [ ] Grid still scrolls when content overflows
