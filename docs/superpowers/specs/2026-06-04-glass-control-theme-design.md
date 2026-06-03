# Glass Control Theme (Checkbox & Button) Design

**Date:** 2026-06-04  
**Status:** Approved  
**Scope:** App-wide (B) — all Mantine `Checkbox` and `Button` instances  
**Visual direction:** Glass outline (A)

## Problem

Detail list checkboxes use Mantine default dark styling (solid indigo fill), which clashes with the app’s glass morphism surfaces (`glass.bg`, semi-transparent cards). Buttons are partially themed in `cleanMacTheme.ts`, but variants are inconsistent across detail, dashboard, settings, and modals.

## Goals

- Unified glass-outline controls across the entire app.
- Single source of truth in theme configuration (no per-screen one-off colors).
- Preserve existing behavior (selection, disabled protected rows, loading states).

## Non-goals

- Changing scan/delete logic or list virtualization.
- Redesigning layout, typography, or category card structure.
- Custom wrapper components (`GlassCheckbox`, etc.) unless theme overrides prove insufficient.

## Design tokens

Extend `src/lib/cleanMacTheme.ts` with a `control` token object alongside `glass`:

| Token | Value | Usage |
|-------|-------|--------|
| `control.border` | `rgba(255, 255, 255, 0.22)` | Unchecked checkbox border; default button border |
| `control.bg` | `rgba(255, 255, 255, 0.04)` | Unchecked checkbox fill (optional subtle tint) |
| `control.bgChecked` | `rgba(255, 255, 255, 0.14)` | Checked checkbox fill |
| `control.check` | `#a5b4fc` (indigo-300) | Check icon; subtle accent |
| `control.label` | `rgba(255, 255, 255, 0.9)` | Checkbox label text |
| `control.disabledOpacity` | `0.35` | Disabled checkbox and button opacity multiplier |
| `control.buttonBgLight` | `rgba(255, 255, 255, 0.12)` | `light` variant background |
| `control.buttonBgDefault` | `rgba(255, 255, 255, 0.08)` | `default` variant background |
| `control.buttonHover` | `rgba(255, 255, 255, 0.16)` | Shared hover overlay |

Tokens must stay in the same rgba family as `glass.border` and `glass.bg`.

## Checkbox (Mantine `components.Checkbox`)

Apply via `cleanMacTheme.components.Checkbox.styles`:

| State | Appearance |
|-------|------------|
| Unchecked | `control.bg` or transparent, `control.border` 1px, no solid primary fill |
| Checked | `control.bgChecked`, border unchanged or slightly brighter, icon `control.check` |
| Disabled | Reduced opacity (`control.disabledOpacity`), no pointer cursor |
| Label | `control.label`; dimmed when disabled |

Targets: detail list rows (`DetailItemList`), settings toggles (`SettingsPanel`), and any future checkbox usage.

Do not rely on Mantine default `primaryColor` fill for the input background.

## Button (Mantine `components.Button`)

Refine existing global `Button` styles to align with glass outline (A):

| Variant | Background | Border | Text | Typical use |
|---------|------------|--------|------|-------------|
| `subtle` | transparent | none | `rgba(255,255,255,0.85)` | Back, Finder reveal |
| `light` | `control.buttonBgLight` | `glass.border` | near-white | Select all, Clean selected |
| `default` | `control.buttonBgDefault` | `glass.border` | near-white | Deselect all, Rescan |
| `filled` | `rgba(99, 102, 241, 0.35)` | `glass.border` | white | Rare primary actions (if used) |

Shared rules:

- Hover: slightly brighter background (`control.buttonHover`), no saturated solid jump.
- Disabled / loading: lower opacity; border remains visible where applicable.
- Focus-visible: thin outline using `control.check` at low alpha (accessibility).

## Implementation approach

**Recommended:** Theme + tokens (方案 2).

1. Add `control` tokens to `cleanMacTheme.ts`.
2. Add `Checkbox` component override in `createTheme({ components: { ... } })`.
3. Update `Button` override to reference `control` tokens instead of inline duplicate rgba values.
4. Remove redundant inline `style` on buttons/checkboxes in detail components if they override theme.
5. Manual visual pass: detail list, detail header/footer, dashboard cards, settings panel, modals.

## Files

| File | Change |
|------|--------|
| `src/lib/cleanMacTheme.ts` | `control` tokens; `Checkbox` + `Button` styles |
| `src/components/DetailItemList.tsx` | Remove conflicting inline styles only if present |
| `src/components/CategoryDetailView.tsx` | Same |
| `src/components/DetailFooter.tsx` | Same |

No Rust or API changes.

## Testing

- `pnpm build` passes.
- Manual checklist:
  - [ ] Detail row checkbox: unchecked / checked / disabled (protected item)
  - [ ] Detail: 全选可删, 取消全选, 在 Finder 中显示, 清理所选
  - [ ] Settings panel checkboxes
  - [ ] Dashboard category card scan buttons
  - [ ] Modal primary/cancel buttons (delete confirm, permissions)

## Risks

| Risk | Mitigation |
|------|------------|
| Mantine v7 selector specificity | Use `styles` API on component; verify in devtools |
| `filled` buttons elsewhere look too weak | Tune `filled` token once; document in theme |
| Contrast fails WCAG on checked state | Keep check icon and border bright enough on dark bg |

## Success criteria

User perceives checkboxes and buttons as one cohesive glass system on dark backgrounds, with no default Mantine solid indigo checkbox boxes in the app.
