# Glass Control Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App-wide glass-outline styling for Mantine Checkbox and Button via `cleanMacTheme`.

**Architecture:** Add `control` design tokens next to `glass`; extend `createTheme({ components })` for `Checkbox` and refined `Button`; no wrapper components.

**Tech Stack:** Mantine 7, React, TypeScript

**Spec:** `docs/superpowers/specs/2026-06-04-glass-control-theme-design.md`

---

### Task 1: Control tokens + theme overrides

**Files:**
- Modify: `src/lib/cleanMacTheme.ts`

- [ ] **Step 1:** Add `control` token object per spec
- [ ] **Step 2:** Add `Checkbox` component styles (input, icon, label; checked/disabled)
- [ ] **Step 3:** Refine `Button` styles (subtle/light/default/filled, hover, disabled, red filled)
- [ ] **Step 4:** Run `pnpm build`

### Task 2: Verify + commit

- [ ] **Step 5:** Manual visual check (detail list, settings, modals)
- [ ] **Step 6:** Commit `feat: glass-outline Checkbox and Button theme`
