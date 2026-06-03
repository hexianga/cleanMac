# Detail Footer In-Flow Layout Design

**Status:** Approved (2026-06-04)  
**Context:** Category detail view uses a `position: fixed` footer (`DetailFooter`) spanning `left: 0; right: 0` at the viewport bottom. The scroll area uses `paddingBottom` to reserve space, but list content (especially with `react-virtuoso`) can still appear under the「清理所选」bar. The fixed bar also overlaps the left sidebar.

## Goal

The detail footer row occupies **only the main content column** (right of the sidebar) and **does not overlap** scrollable list content.

## Decisions

| Topic | Choice |
|-------|--------|
| Footer width | **A:** Main column only; never cover sidebar |
| Layout model | In-flow flex footer inside `main` (not `position: fixed`) |
| Footer height | Keep `DETAIL_FOOTER_HEIGHT_PX` (72) |
| Dashboard | Unchanged (no footer) |

## Non-goals

- Changing footer copy, buttons, or selection logic
- Collapsing footer when nothing selected
- Full-window floating footer
- AppShell migration

## Architecture (chosen)

Replace viewport-fixed footer with a **two-row flex column** inside `main` when `detail.view === "detail"`:

```
main (flex column, flex 1, minHeight 0)
├── scroll region (flex 1, minHeight 0, overflow auto, ref=detailScrollRef)
│   └── CategoryDetailView + DetailItemList (Virtuoso / grouped virtual)
└── footer region (flexShrink 0, height DETAIL_FOOTER_HEIGHT_PX)
    └── DetailFooter
```

Remove `paddingBottom: DETAIL_FOOTER_HEIGHT_PX + 8` from the scroll region.

Remove the outer `position: fixed` wrapper around `DetailFooter`.

## Files

| File | Change |
|------|--------|
| `src/App.tsx` | Restructure detail branch: scroll + in-flow footer; delete fixed footer block |
| `src/lib/layoutConstants.ts` | No change unless measured height differs |
| `src/components/DetailFooter.tsx` | No change (optional: ensure `h="100%"` still valid) |

## Behavior

- Scrolling happens only in the upper region; footer stays pinned to the bottom of `main`, not the viewport.
- Virtuoso `customScrollParent` continues to use `detailScrollRef` on the scroll region.
- Last list row remains fully visible above the footer when scrolled to end.
- Footer horizontal bounds match main content (same padding as detail body: `px="md"` on scroll area; footer uses existing `DetailFooter` `px="md"`).

## Error / edge cases

- Window resize: flex layout reflows automatically; no manual inset math.
- Short window: scroll region shrinks; footer height constant.
- Detail without footer (`showDetailFooter` false): not applicable today (`showDetailFooter` true whenever detail category exists); if false in future, render scroll-only.

## QA

- [ ] Open video/image detail with many items; scroll to bottom — last row not hidden under「清理所选」
- [ ] Footer does not extend under left sidebar (120px)
- [ ] Dashboard view unchanged
- [ ] `pnpm test && pnpm build` pass

## Risks

| Risk | Mitigation |
|------|------------|
| Double vertical padding | Remove old `paddingBottom` when removing fixed footer |
| Main not flex column in detail | Wrap detail scroll + footer in fragment or single flex child column |
