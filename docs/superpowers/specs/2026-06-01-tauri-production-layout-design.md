# Tauri Production Layout & DevTools Design

**Status:** Approved (2026-06-01)  
**Context:** v0.1.2+ DMG loads CSS/JS (`base: "./"`), but dashboard layout is broken: sidebar overlaps main content, category cards have inconsistent sizes and no gutters, Mantine Grid appears ineffective.

## Root cause

CleanMac is a desktop-only app (min window 960×640) but uses Mantine **responsive** APIs:

1. **AppShell** `navbar.breakpoint: "sm"` — below 768px (or when WebView mis-reports width), navbar overlays main instead of reserving horizontal space.
2. **Grid** `span={{ base: 12, sm: 6, md: 3 }}` — column widths and `gutter` depend on media-query breakpoints; when breakpoints do not apply in WKWebView, columns lack width/gap rules.

Dev: `localhost:5173` behaves correctly. Production: Tauri custom protocol + WebView viewport → responsive CSS unreliable.

## Approach (chosen)

**A — Desktop-fixed layout** (minimal change, no AppShell/Grid rewrite)

| Area | Change |
|------|--------|
| AppShell | `navbar.breakpoint: -1` — always show navbar, always offset main |
| Grid | `Grid.Col span={3}` — fixed 4 columns on 12-column grid |
| CSS | `min-width: 0` on `.mantine-AppShell-main` (flex overflow guard) |
| DevTools | `devtools: true` in `tauri.conf.json` window config |

Not in scope: responsive layout below 960px, PostCSS/Mantine preset migration, replacing AppShell.

## Files

| File | Change |
|------|--------|
| `src/App.tsx` | `navbar.breakpoint: -1` |
| `src/components/DashboardView.tsx` | Fixed `span={3}` on `Grid.Col` |
| `src/globalScroll.css` | AppShell main `min-width: 0` |
| `src-tauri/tauri.conf.json` | `"devtools": true` on main window |
| `README.md` or `CONTRIBUTING.md` | Note ⌥⌘I to open DevTools in release builds |

## QA

- [ ] `pnpm tauri:build` → install DMG: sidebar does not overlap disk header
- [ ] Classification tab: 7 cards in 4-column grid with equal card widths and `md` gutters
- [ ] File type tab: same grid behavior
- [ ] Release build: ⌥⌘I (or documented shortcut) opens Web Inspector
- [ ] `pnpm test` and `pnpm build` pass

## Risks

| Risk | Mitigation |
|------|------------|
| `breakpoint: -1` unsupported in Mantine version | Fall back to `breakpoint: 0` or explicit main `padding-inline-start` in CSS |
| Double horizontal inset | Only add CSS fallback if QA still shows overlap |
