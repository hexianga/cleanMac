# Detail Footer Flush to Window Bottom-Right Design

**Status:** Approved (2026-06-04)  
**Context:** Detail footer uses in-flow layout inside `main` (see `2026-06-04-detail-footer-in-flow-design.md`). The `.app-frame` wrapper applies uniform `padding: var(--mantine-spacing-md)` on all sides, leaving visible background gaps to the **right** and **below** the footer bar. User wants the footer background flush to the window content area on those edges (choice **A**).

## Goal

The detail footer bar background extends to the bottom-right of the app frame (canceling frame padding on right and bottom for the footer only). Scrollable list content keeps existing padding.

## Decisions

| Topic | Choice |
|-------|--------|
| Edges to flush | Right + bottom only (not left/top) |
| Scope | Footer bar only; not the scroll/list region |
| Inner content | Keep `DetailFooter` `px="md"` for text and button spacing |
| Dashboard | Unchanged |

## Non-goals

- Removing app-frame padding globally in detail view
- Bleeding the scroll area to window edges
- Moving the clean button flush to the physical window edge

## Architecture (chosen)

Apply **negative margin + width compensation** on the footer wrapper `Box` in `App.tsx` (detail branch only):

```css
margin-right: calc(-1 * var(--mantine-spacing-md));
margin-bottom: calc(-1 * var(--mantine-spacing-md));
width: calc(100% + var(--mantine-spacing-md));
```

Parent `main` or detail column must allow the footer to paint into the padding box:

- If `overflow: hidden` clips the bleed, set the detail column wrapper to `overflow: visible` while keeping the scroll child `overflow: auto`.

Optional: `border-bottom-right-radius` on the footer wrapper if the window/client area uses rounded corners (match existing app chrome).

## Files

| File | Change |
|------|--------|
| `src/App.tsx` | Footer wrapper styles (negative margin + width) |
| `src/globalScroll.css` or `App.tsx` | Overflow tweak on detail column if clipped |

## QA

- [ ] Detail view: no gap between footer background and window content bottom/right edges
- [ ] List scroll region still has horizontal/bottom inset above footer
- [ ] Last list row not hidden under footer
- [ ] Dashboard padding unchanged
- [ ] `pnpm build` passes

## Risks

| Risk | Mitigation |
|------|------------|
| Negative margin clipped | Adjust overflow on detail flex column |
| Horizontal scrollbar | Avoid width bleed on scroll area; footer only |
