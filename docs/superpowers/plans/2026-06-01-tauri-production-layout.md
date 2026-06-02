# Tauri Production Layout Implementation Plan

> **For agentic workers:** Use executing-plans or implement directly (small scope).

**Goal:** Fix packaged app dashboard layout (sidebar overlap, broken Grid) and enable DevTools in release builds.

**Architecture:** Disable AppShell responsive navbar collapse; use fixed 4-column Grid; enable `devtools` in Tauri window config.

**Spec:** `docs/superpowers/specs/2026-06-01-tauri-production-layout-design.md`

---

### Task 1: Layout fixes

- [x] `App.tsx` — `navbar.breakpoint: -1`
- [x] `DashboardView.tsx` — `Grid.Col span={3}`
- [x] `globalScroll.css` — `.mantine-AppShell-main { min-width: 0 }`

### Task 2: DevTools

- [x] `tauri.conf.json` — `"devtools": true`
- [x] `README.md` — ⌥⌘I shortcut note

### Task 3: Verify

- [ ] `pnpm build && pnpm test`
- [ ] `pnpm tauri:build` — manual QA on DMG
