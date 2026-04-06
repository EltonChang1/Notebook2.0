# Notebook 2.0 — Style guide (visual & UI patterns only)

> **Scope:** This document covers **how the app looks and feels**—tokens, layout, components, motion, and accessibility *presentation*.  
> **Product scope, features, and the Notion-template checklist** live in **[PRD.md](./PRD.md)** only.

**Goals**

- **Neat, clear, easy to scan** — calm hierarchy, generous whitespace, one obvious primary action per section.
- **Consistent surfaces** — same card, button, and list language across modules.
- **Dark and light** — both themes intentional and readable.

---

## Code layout (UI implementation)

| Item | Location / rule |
|------|------------------|
| **Path alias `@/`** | Maps to `src/` (`vite.config.ts`, `tsconfig.app.json`). |
| **Shared UI** | **`src/components/ui/`** (e.g. `bento-grid.tsx`). |
| **`cn()`** | **`src/lib/utils.ts`** — `clsx` + `tailwind-merge`. |
| **Icons** | **`lucide-react`** for new work. |
| **Dark mode** | Theme is `body[data-theme="dark"]`; Tailwind **`dark:`** must follow app theme, not only the OS. |

---

## Design principles (visual)

1. **Calm by default** — Low noise; few competing accents.
2. **Whitespace is structure** — Separate ideas with space before adding borders.
3. **Subtle surfaces** — Light borders and gentle elevation; avoid heavy chrome.
4. **One primary per area** — One filled / dominant CTA; everything else secondary or ghost.
5. **Scannable** — Titles, meta lines, and actions align predictably (Notion-like *clarity*, not a Notion clone).

---

## Navigation & layout (visual)

- **Sidebar + main:** Clear active state; icon + label readable at a glance.
- **Mobile bottom nav:** Same order as task priority; touch targets ≥ 44px where possible.
- **Page structure (every major screen):**  
  1. Page title + optional subtitle  
  2. One-line helper (muted)  
  3. Primary actions row  
  4. Content body  
- **Max content width:** ~`1200px`; comfortable horizontal padding (`24px` desktop, `16px` mobile).
- **Section rhythm:** `24px` between major blocks; `16px` inside cards.

---

## Bento grid (dashboard quick access)

Implemented in **`src/components/ui/bento-grid.tsx`**.

- **Grid:** `1` column → `3` columns from `md`; optional **`colSpan: 2`** on desktop.
- **Card shell:** `rounded-xl`, light border, white / black surface in dark mode, slight **hover lift** and soft shadow.
- **Dot-grid texture:** Overlay uses **`inset-x-0 bottom-0 -top-3`** (extends **12px** above the inner box); inner gradient uses **`absolute inset-0`** with `bg-[length:4px_4px]` radial dots. Hover or **persistent hover** controls opacity of the overlay layer.
- **Keyboard:** Navigating tiles must support **Enter** / **Space** when `onSelect` is set.

---

## Color (semantic)

Prefer **CSS variables** from `src/styles.css` (`--text-primary`, `--border`, `--accent`, etc.). For Tailwind-heavy surfaces (e.g. bento), keep **light** neutrals and **dark:** mirrors with low contrast borders.

| Role | Light intent | Dark intent |
|------|----------------|-------------|
| Canvas | Soft off-white / gray | Near-black |
| Surface / card | White or subtle gray | Slightly lifted from canvas |
| Text primary | Near-black | Near-white |
| Text secondary | Mid gray | Muted gray |
| Border | Light gray | Low-contrast line |
| Primary CTA | Accent (Settings-driven `--accent` where used) | Same role, adjusted luminance |

Do not introduce **ad hoc hex** for new screens if a token exists.

---

## Typography

- **Font:** Inter (or stack in `index.html` / CSS), system fallbacks.
- **Scale (reference):** 12 / 14 / 16 / 20 / 24 / 32 px.
- **Page title:** largest semibold on the page; tight tracking (`-0.01em` to `-0.02em`).
- **Section titles:** clearly smaller than page title; **subsection** one step down again.
- **Body:** 14–16px; one size per surface type, consistent per route.
- **Meta / captions:** smaller + secondary color.
- **Line length:** ~60–90 characters for paragraphs where possible.
- Avoid all-caps except tiny badges.

---

## Spacing & radius

- **Base unit:** 4px. Use **4, 8, 12, 16, 24, 32, 40, 48, 64**.
- **Inside tight controls:** 8–12px. **Inside cards:** 16px. **Between cards:** 16–24px. **Between page sections:** 24–32px.

**Radius**

- Small (inputs, chips): **8px**
- Medium (cards, buttons): **12px** (`rounded-xl` on bento matches product cards)
- Large (modals): **16px**
- Pills: **9999px**

---

## Shadows & elevation

- Default: **none** or very subtle (`0 1px 2px` class of shadow).
- **Hover** on bento: light shadow as implemented in `bento-grid.tsx`.
- Modals/dropdowns: slightly stronger than cards; avoid heavy depth on dense pages.

---

## Components (appearance)

### Buttons

- **Primary:** Solid accent; **one** per logical section.
- **Secondary:** Outline or soft fill.
- **Danger:** Distinct red for destructive actions.
- Height ~**36–40px**; padding **12–16px** horizontal; **focus-visible** ring always.

### Inputs

- Consistent height (~40px), **8px** radius, visible **labels** (not placeholder-only).
- Errors: text below in danger color.

### Cards / tiles (`.tile` and bento)

- Border-first; padding **16px** default.
- Header = title + optional helper; actions grouped with the content they affect.

### Badges & chips

- Low saturation; readable contrast; limit rainbow clutter.

### Tables & lists

- Clear row separation; optional zebra only if density demands it.
- Sticky header for long tables.

---

## Motion

- **120–180ms** transitions; ease-out.
- No distracting entrance animations on routine navigation.

### Empty states

- Short message + **one** clear next-step control.

---

## Accessibility (UI)

- Contrast toward **WCAG AA** for text and controls.
- **Keyboard:** full tab order; **focus-visible** on interactive elements.
- Status not by **color alone** — add text or icon.
- Meaningful **labels** and **aria** on custom controls (e.g. role="button" on bento tiles).

---

## Module visual notes

Use the same **tile / section** pattern everywhere; only **density** changes.

| Area | Visual note |
|------|-------------|
| **LeetCode** | Dense table: row height, dividers, readable tags. |
| **Reading** | Editorial calm; flashcard = single focal card. |
| **Calendar** | Grid lines subtle; event blocks readable, not neon. |
| **Notes** | Editor column spacing; preview typography clean. |
| **Groups** | Shared vs personal = label/badge, not harsh color split. |
| **Settings** | Grouped sections with dividers; privacy blocks clear but calm. |
| **AI panels** | Same panel chrome everywhere; clear separation of prompt / output / drafts. |

---

## Do / don’t

**Do:** Whitespace, light borders, clear type hierarchy, consistent bento language on home.  
**Don’t:** Heavy shadows everywhere, many accent colors in one view, hiding actions behind purely visual minimalism.

---

## Definition of done (UI)

- Matches **tokens and patterns** in this guide.
- **Dark + light** both usable.
- **Keyboard** and **focus** sane on new interactives.
- **Responsive:** readable on narrow viewports; nav pattern from PRD preserved.
- **Bento** (if touched): dot overlay geometry unchanged unless this doc is updated.

---

*End of styleguide.md*
