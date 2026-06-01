# Scroll Layout & Disable Overscroll Bounce Design

**Status:** Approved (brainstorming, 2026-05-31)  
**Scope:** Fixed chrome + internal scrolling on dashboard and detail views; app-wide disable of rubber-band / spring overscroll (including modals).

## Summary

Constrain the main window to a fixed viewport height so only designated `ScrollArea` regions scroll. On the dashboard, keep the disk header and「开始扫描」fixed while the category card grid scrolls. On the detail view, keep navigation, alerts, summary, and batch actions fixed while only the item table scrolls. Apply global CSS so all scrollable surfaces (including Mantine modals) do not exhibit elastic overscroll bounce.

## Brainstorming Decisions

| Topic | Choice |
|-------|--------|
| Dashboard scroll | **B:** `DashboardHeader` fixed; card `Grid` in `ScrollArea` |
| Detail scroll | Return bar, title, cache Alert, stats, select buttons fixed; table list scrolls |
| Overscroll bounce | **C:** Entire app — homepage, detail, modals, any `ScrollArea` |
| Table header sticky | Not in v1 (thead scrolls with table body) |
| Implementation approach | **1:** Global CSS + flex height chain (no Tauri native elastic API in v1) |

## Out of Scope

- Sticky table column headers inside detail list
- Separate scroll for left sidebar (nav stays fixed; content is short)
- Tauri/WKWebView native elastic-scroll disable (unless CSS proves insufficient in QA)

---

## Layout Architecture

```
AppShell.Main (flex column, fixed height, overflow: hidden)
└── Container (flex: 1, minHeight: 0, flex column)
    ├── dashboard → DashboardView (flex: 1, minHeight: 0, column)
    │   ├── DashboardHeader (flex-shrink: 0)
    │   └── ScrollArea (flex: 1, minHeight: 0) → Grid of CategoryCards
    └── detail → CategoryDetailView (flex: 1, minHeight: 0, column)
        ├── chrome: back, title, Alert?, stats, 全选/取消 (flex-shrink: 0)
        └── ScrollArea (flex: 1, minHeight: 0) → Table (+ group rows)
```

### Height chain

- `html`, `body`, `#root`: `height: 100%`, `overflow: hidden` — no document-level scroll.
- `AppShell.Main`: compute height below custom title bar (`MAC_TITLE_BAR_HEIGHT` + Mantine padding); `display: flex`, `flexDirection: column`, `overflow: hidden`.
- When detail footer visible: reduce main content height by footer height (72px + existing padding) so last table rows are not hidden behind footer.
- All flex children that host a `ScrollArea` must have `minHeight: 0` (critical for flex scroll).

---

## Dashboard (`DashboardView`)

| Region | Behavior |
|--------|----------|
| `DashboardHeader` | Fixed at top of dashboard column (disk, settings, 开始扫描) |
| Card `Grid` | Wrapped in `ScrollArea` with `flex={1}`; scrolls when cards exceed viewport |
| Sidebar | Unchanged; not a scroll container |

When content fits viewport: no scrollbar on grid area.

---

## Detail (`CategoryDetailView`)

| Fixed (non-scrolling) | Scrolling |
|----------------------|-----------|
| 返回 + category title | Table body |
| Cache `Alert` (if shown) | Group header rows inside table |
| Item count + total bytes | |
| 全选可删 / 取消全选 | |

Existing `Stack h="100%"` + `ScrollArea flex={1}` retained; parent chain must supply real height (see above).

Optional: `ScrollArea` bottom padding when detail footer is shown (e.g. 8–16px) so last row clears footer visually.

---

## Global No-Bounce CSS

New file: `src/globalScroll.css` (imported from `main.tsx` before app render).

```css
html,
body,
#root {
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
}

.mantine-ScrollArea-viewport {
  overscroll-behavior: none;
}
```

Utility (optional): `.no-overscroll { overscroll-behavior: none; }` for modal nodes with `overflow: auto` outside Mantine `ScrollArea`.

Do **not** set `overflow: hidden` on modal portals in a way that blocks modal scroll — only root/document.

---

## Files to Touch

| File | Change |
|------|--------|
| `src/globalScroll.css` | New — overscroll + root height |
| `src/main.tsx` | Import global CSS |
| `src/App.tsx` | Main flex column, height, `minHeight: 0` on Container/Stack |
| `src/components/DashboardView.tsx` | Split header vs `ScrollArea` grid |
| `src/components/CategoryDetailView.tsx` | Verify flex props; optional scroll padding |
| `index.html` | Optional align `body` with global CSS (avoid duplicate rules) |

No Rust changes.

---

## Testing / Manual QA

- [ ] Detail: scroll long list — top chrome does not move; footer does not clip last rows
- [ ] Dashboard: scroll cards — disk header stays fixed
- [ ] Dashboard & detail: no rubber-band when scrolling past top/bottom
- [ ] Settings modal / delete confirm (long lists): scroll works, no bounce
- [ ] Window resize: scroll regions still receive correct height
- [ ] Switch dashboard ↔ detail: layout does not restore document scroll

---

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| `overscroll-behavior` ignored in some WebView builds | Document in QA; fallback task for Tauri macOS config if needed |
| `h="100%"` ineffective without parent height | Enforce flex chain in `App.tsx` + views |
| Modal scroll broken by `body overflow: hidden` | Mantine portals scroll inside overlay; test modals explicitly |
