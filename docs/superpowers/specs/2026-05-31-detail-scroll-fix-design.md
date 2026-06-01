# Detail View Scroll Fix Design

**Status:** Approved (2026-05-31)  
**Problem:** Detail item list does not scroll (symptom A); bottom rows unreachable.  
**Approach:** Complete flex height chain so `VirtualDetailItemList` scroll viewport receives bounded height.

## Summary

The detail view uses `@tanstack/react-virtual` with an inner `overflow: auto` container. Scrolling requires that container to have a **non-zero, viewport-bounded height**. Today `AppShell.Main` → `Container` → `Stack` → `CategoryDetailView` does not fully constrain height, so content is clipped by `overflow: hidden` on Main without an internal scroll surface.

Fix by enforcing `flex: 1`, `minHeight: 0`, and `overflow: hidden` on each flex column ancestor, leaving a single `overflow: auto` region inside `VirtualDetailItemList`.

## Layout (target)

```
AppShell (height: 100%)
└── Main (flex column, flex:1, minHeight:0, overflow:hidden)
    └── Container (flex:1, minHeight:0, column, overflow:hidden)
        └── Stack (flex:1, minHeight:0, column, overflow:hidden)
            └── detail Box (flex:1, minHeight:0, column, overflow:hidden)
                └── CategoryDetailView (column, overflow:hidden)
                    ├── chrome (flexShrink:0)
                    └── VirtualDetailItemList (flex:1, minHeight:0)
                        ├── table header (flexShrink:0)
                        └── scroll viewport (flex:1, minHeight:0, overflow:auto)
```

## Changes

| File | Change |
|------|--------|
| `src/globalScroll.css` | `AppShell-main` flex column + `min-height: 0` |
| `src/App.tsx` | Detail wrapper `overflow: hidden`; Stack column flex when in detail |
| `src/components/CategoryDetailView.tsx` | Root column `overflow: hidden`, explicit flex |
| `src/components/VirtualDetailItemList.tsx` | Scroll area `overflow: hidden` on shell; optional bottom padding |

## Out of scope

- Sticky table header
- Replacing virtual list with full `ScrollArea` wrapper (only if flex fix fails in QA)
- Rust / scan logic changes
- Dashboard scroll changes

## QA

- [ ] Long detail list scrolls; chrome (back, title, buttons) stays fixed
- [ ] Last rows visible above footer when footer shown
- [ ] With cache Alert visible, list still scrolls
- [ ] Window resize preserves scroll
- [ ] Dashboard card grid scroll unchanged
- [ ] No document-level rubber-band scroll

## Risks

| Risk | Mitigation |
|------|------------|
| Mantine `Stack` ignores child flex | Use inline `display:flex` on wrappers |
| AppShell main not flex child | Global CSS on `.mantine-AppShell-main` |
| Virtualizer zero height | Verify `scrollRef.current.clientHeight > 0` in manual QA |
