# Notebook 2.0 UI Style Guide

## Purpose

This style guide defines a **clean, minimal UI system** for Notebook 2.0 while preserving all functionality in `PRD.md`.

Goals:
- Keep every feature and workflow from the PRD.
- Improve visual clarity through whitespace, hierarchy, and subtle dividers.
- Standardize components so future implementation stays consistent.

---

## Design Principles

1. **Calm by default**  
   UI should feel quiet and focused: low visual noise, few competing accents.

2. **Whitespace is structure**  
   Use spacing to separate ideas before adding borders or color.

3. **Subtle surfaces and dividers**  
   Prefer light gray borders and gentle elevation over heavy cards/shadows.

4. **One primary action per area**  
   Each section has one clear main CTA; all other actions are secondary/tertiary.

5. **Function-first clarity**  
   Never hide core PRD functionality behind style decisions.

---

## Layout System

### Page Container
- Max width: `1200px`
- Horizontal padding: `24px desktop`, `16px tablet/mobile`
- Vertical rhythm: `24px` between major sections

### Grid
- Use a 12-column mental model for desktop.
- Standard tile gap: `16px`.
- Mobile: collapse to single column; preserve action order by task priority.

### Section Structure
Each major section follows:
1. `Section title`
2. `One-line helper text`
3. `Actions row`
4. `Content body`

---

## Color Palette

Use semantic tokens (not raw hex in components):

- Primary: `#2563eb` (`--primary`) for main actions and key interactive elements.
- Secondary: `#64748b` (`--secondary`) for supporting actions and secondary emphasis.
- Background: `#f8f9fb` (`--bg`) for the main app canvas.
- Surface: `#ffffff` (`--surface`) for cards, modals, and raised containers.
- Text Primary: `#111827` (`--text-primary`) for headings and body copy.
- Text Secondary: `#6b7280` (`--text-secondary`) for helper text, captions, placeholders.
- Border: `#e5e7eb` (`--border`) for dividers and input outlines.
- Success: `#16a34a` (`--success`)
- Warning: `#d97706` (`--warning`)
- Error: `#dc2626` (`--error`)

Supporting tokens:
- `--surface-muted`: `#f3f4f6`
- `--focus-ring`: `rgba(37, 99, 235, 0.35)`
- `--accent`: user-selected accent color in Settings (used as a controlled override, not a new palette color).

Dark mode should preserve the same semantic roles with equivalent contrast.

---

## Typography

- Font Family: **Inter** (Google Fonts), with system-ui fallbacks.
- Headings: semibold/bold with slightly tight tracking (`-0.01em` to `-0.02em`).
- Body: regular weight.
- Size Scale: `12 / 14 / 16 / 20 / 24 / 32 / 40 / 48px`.
- Base body size: `14px` or `16px` depending on density context (stay consistent per page).
- Heading hierarchy:
  - Page title: `28/32`, semibold
  - Section title: `18/24`, semibold
  - Subsection title: `15/20`, medium
- Helper/meta text: smaller size + `text-secondary`

Rules:
- Avoid all-caps labels except tiny badges.
- Keep line length comfortable (`60-90` chars for paragraphs).

---

## Spacing Scale

Use a 4px base unit. Allowed spacing values:
- `4, 8, 12, 16, 24, 32, 40, 48, 64`

Rules:
- Inside compact controls: `8-12`
- Inside cards/forms: `16`
- Between cards/major blocks: `24`
- Between page-level groups: `32`
- Section breathing room on content-heavy pages: `48`

---

## Border Radius

- Small (inputs, chips): `8px`
- Medium (cards, buttons): `12px`
- Large (modals, containers): `16px`
- Full (avatars, pills): `9999px`

---

## Shadows

- Subtle: `0 1px 2px rgba(0,0,0,0.05)`
- Medium: `0 4px 12px rgba(0,0,0,0.1)`
- Strong: `0 8px 24px rgba(0,0,0,0.15)`

Usage rule for this product aesthetic:
- Default to **Subtle** or no shadow.
- Use **Medium** only for overlays (dropdowns/modals/popovers).
- Avoid **Strong** in normal page layout to preserve the minimal look.

---

## Divider and Surface Style

- Default card:
  - `background: var(--surface)`
  - `border: 1px solid var(--border)`
  - `border-radius: 12px`
  - minimal/no shadow
- Use horizontal dividers (`1px var(--border)`) between dense lists/sections.
- Do not stack multiple strong borders; one boundary is enough.

---

## Component Standards

### Buttons
- Primary: solid accent, used once per section.
- Secondary: neutral outline/subtle fill.
- Danger: explicit red style for destructive actions.
- Height: `36px` desktop, `40px` mobile.
- Padding: `0 12px` (compact), `0 16px` (default).
- Radius: `12px` (medium radius token).
- Hover:
  - Primary: slightly darker fill (`~6-8%` darker)
  - Secondary: subtle surface tint + border darken
- Focus-visible: always show `--focus-ring`.

### Inputs / Select / Textarea
- Single consistent height and radius.
- Label always visible (not placeholder-only).
- Error text below field in danger color.
- Use muted helper text for format hints.
- Input/Select height: `40px`; Textarea: min `88px`.
- Horizontal padding: `12px`.
- Radius: `8px` (small radius token).
- Focus: `1px` border + outside ring using `--focus-ring`.

### Cards/Tiles
- Prefer flatter cards with whitespace rather than heavy backgrounds.
- Card header has title + optional helper text.
- Place actions near content they affect.
- Padding: `16px` standard, `24px` for major panels.
- Radius: `12px` (medium token).
- Border-first treatment; shadow optional and subtle.

### Badges/Chips
- Use low-saturation backgrounds.
- Keep text readable (AA contrast).
- Limit simultaneous chip colors to reduce noise.

### Tables and Lists
- Use zebra striping only if needed; default is clean rows + divider lines.
- Sticky header for long tables.
- Sort affordance visible but subtle.

---

## Interaction Patterns

### States
- Required states for interactive elements:
  - default
  - hover
  - active
  - focus-visible
  - disabled

### Motion
- Keep motion minimal and functional.
- Transition duration: `120-180ms`.
- Avoid large entrance animations.

### Empty States
- Every module should have:
  - concise empty message
  - one next-step action button

### Feedback
- Inline status for sync/AI operations.
- Use clear success/failure text; no ambiguous messages.

---

## Accessibility Requirements

- Meet WCAG AA contrast for text and controls.
- Keyboard-accessible for all workflows.
- Visible focus ring on tab navigation.
- Labels for all form controls.
- Do not communicate status by color alone; pair with text/icon.

---

## Module-Specific Guidelines

These rules improve style only; they **must not remove PRD functionality**.

### LeetCode Tracker
- Keep dense data readable via row spacing and clear dividers.
- Prioritize scanability: title, status, difficulty, topics.
- AI panel should visually align with other module AI panels.

### Reading Tracker
- Bookshelf and knowledge list should feel calm and editorial.
- Flashcard mode: single focal card, minimal distractions.
- AI tools remain inline, with clear generated-output area.

### Calendar
- Time grid should use subtle separators and high-contrast text.
- Event blocks should be color-coded but low-saturation.
- AI plan drafts should look like editable form rows with clear selection controls.

### Notes
- Editor and preview columns need generous spacing.
- Markdown preview should be typographically clean, not overly decorated.

### Groups
- Distinguish personal vs shared context with labels, not harsh colors.

### Settings
- Group toggles by category with section dividers.
- Keep security/privacy controls visually prominent but not alarming.

---

## AI UI Consistency

All AI surfaces (chat + module assistants) should share:
- Same panel shape, spacing, and typography.
- Same loading and error message patterns.
- Same “model/provider transparency” style.
- Clearly separated:
  - prompt/actions
  - streaming output
  - editable artifacts (draft plans/flashcards)

---

## Implementation Rules for Future Work

When building new UI:
1. Start with existing functionality from `PRD.md`.
2. Apply this style guide tokens/layout before adding custom variants.
3. Reuse existing component patterns when possible.
4. Add new styles only if no existing pattern fits.
5. Prefer semantic class names and avoid one-off style hacks.

Global style rules:
1. Never introduce colors outside this palette.
2. Always use the spacing scale; no arbitrary spacing values.
3. Maintain consistent border radius per element type.
4. When in doubt, increase whitespace; this aesthetic should breathe.

---

## “Do / Don’t” Quick Reference

Do:
- Use whitespace and light gray dividers for structure.
- Keep pages visually quiet and easy to scan.
- Keep CTA hierarchy clear.

Don’t:
- Add heavy shadows, thick borders, or overly saturated backgrounds.
- Introduce multiple competing accent colors in one view.
- Hide core actions behind style-only simplification.

---

## Definition of Done (UI)

A feature UI update is complete when:
- It preserves all required function from `PRD.md`.
- It follows spacing/color/typography rules above.
- It includes keyboard/focus/error states.
- It passes basic responsive checks (mobile + desktop).
- It remains visually consistent with existing module patterns.
