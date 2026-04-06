# Notebook 2.0 — Product Requirements Document

> **Visual system:** **[styleguide.md](./styleguide.md)** — tokens, bento cards, typography, spacing, a11y *presentation*. This **PRD** is scope, IA, features, and checklist only.  
> **Playbook pointer:** **[update.md](./update.md)** redirects here.

---

## 1. Vision

Notebook 2.0 is a **single student workspace** that feels like a **clear Notion-style hub**: home briefing, classes, schedule, notes, tasks, and optional depth (reading, groups, interview prep)—**neat, easy to navigate**, and fast.

**Class-first:** Everyday school rhythm comes before LeetCode or test prep.

**Template reference:** Exported Notion student kit in  
[`ExportBlock-7095080b-b50b-4e8a-84c2-5d56272f5866-Part-1/`](./ExportBlock-7095080b-b50b-4e8a-84c2-5d56272f5866-Part-1/)  
(home, Assignment Tracker, Notes Hub, Meeting Notes, Pomodoro link, Passion Projects, To Dos, Classes CSVs, note templates).

---

## 2. Navigation & clarity (product rules)

| Rule | Implementation |
|------|----------------|
| **Predictable IA** | Primary: **Home, Reading, Calendar, Notes, Groups, Courses**, **More**, **Settings**. Same entries in command palette (⌘K) and mobile nav where applicable. |
| **Shallow paths** | Core jobs reachable in **≤2 clicks** from Home (bento + dashboard sections). |
| **Obvious labels** | Page titles and section headers match user language (“Courses,” “Reading,” not internal codenames). |
| **One primary action** | Per screen area — see **styleguide.md** for visual enforcement. |
| **⌘/Ctrl+2** | Goes to **More** (not directly to LeetCode). |
| **Progressive disclosure** | Large LeetCode dashboard block hidden until the user has problems or a sync username, or chooses “Show interview prep.” |

---

## 3. Notion-template checklist — have vs need

Legend: **Have** = shipped in app at useful depth · **Partial** = exists but missing template parity · **Need** = not built or stub only

| Template / surface | App location | Status | Notes |
|--------------------|--------------|--------|--------|
| **Home hub** (nav, quick capture, reminders, links, DB embeds) | `/` Dashboard | **Partial** | Bento, today strip (next class, deadline, due readings), week-by-course, reading snapshot, quick actions, interview prep disclosure **Have**. **Need:** important links CRUD, reminders checklist block, quick capture prominence matching template. |
| **Classes** | `/courses` | **Have** | Courses + syllabus/LMS URLs; link notes, events, knowledge points. |
| **Assignment Tracker** | *Dedicated module* | **Need** | List/board: title, course, due, status, link to note/event. Dashboard “due this week.” |
| **To Dos** (`Task`, `Property`, `Category`, `Due Date`) | *Store + UI* | **Need** | Global todos + dashboard widget. |
| **Notes Hub** + DB fields (`Class`, `Lecture`, `Date`, `Attachments`, `Comments`) | `/notes` | **Partial** | Rich editor, templates, wikilinks, search, course filter & chips **Have**. **Need:** lecture/date/attachment/comments parity; **Cornell** + **Simple** structured templates from export. |
| **Meeting Notes** | *Dedicated or Notes filter* | **Need** | Meetings: name, category, last meeting, to-do flag, notes body. |
| **Pomodoro Timer** | `/calendar` Focus | **Have** | Timer + log session to calendar (template used external embed). |
| **Passion Projects** | *Dedicated* | **Need** | Status, category, priority, progress %, dates, goals, ideas, notes. |
| **Reading** (app extension) | `/reading` | **Have** | Bookshelf, knowledge points, flashcards, exports, course chips. |
| **Calendar** | `/calendar` | **Have** | Day/week/month/agenda, recurrence, reminders, focus, AI drafts, course filter, new-event prefill from dashboard. |
| **Groups** | `/groups` | **Partial** | Baseline vs full PRD collaboration (Phase 7). |
| **LeetCode** | `/leetcode`, `/more` | **Have** | Full tracker, sync, SR, deep dives. |
| **Test prep placeholders** | `/more` | **Partial** | Disabled placeholders until spec’d. |
| **Settings** | `/settings` | **Have** | Theme, notifications, AI, LeetCode username, etc. |
| **Command palette & search** | Global | **Have** | ⌘K; extend as new routes ship. |
| **AI** | Panel + modules | **Have** | Off by default; per-feature toggles; BYOK. |

---

## 4. Information architecture (target)

```
Home ──┬── Reading    Calendar    Notes    Groups    Courses
       └── More ── LeetCode + test prep placeholders
       Settings (global)
```

**Bento quick access** on Home must follow **styleguide.md** (`BentoGrid`: borders, hover, dot overlay).

---

## 5. Feature requirements (summary)

### 5.1 Home (Dashboard)

- Bento links to main modules (style per styleguide).
- **Today:** next class, top deadline, due readings; upcoming list; open calendar.
- **This week & reading:** course-linked activity + reading counts + CTAs.
- **Quick actions:** new note, new event (today prefill on calendar).
- **Interview prep:** disclosed per §2.
- **Future template parity:** assignments snippet, important links, reminders list, quick capture block.

### 5.2 Courses

- CRUD; color; term; syllabus/LMS URLs; relations to notes, events, knowledge points, (future) assignments.

### 5.3 Assignments (to build)

- CRUD; `courseId`; due datetime; status; optional link to note; filters; dashboard summary.

### 5.4 To dos (to build)

- Fields aligned with export: task, property, category, due date; dashboard + list view.

### 5.5 Notes

- Tiptap; pinning; tags; wikilinks; course linkage; templates (add Cornell + Simple lecture layout).

### 5.6 Meetings (to build)

- CRUD aligned with export schema; optional templates.

### 5.7 Passion projects (to build)

- CRUD aligned with export CSV columns.

### 5.8 Reading, Calendar, LeetCode, More, Groups, AI

- As implemented; expand Groups toward collaboration spec when scheduled.

---

## 6. Technical stack

- **Vite + React + TypeScript + Tailwind v4**
- **`@/`** → `src/`; **`cn()`** in `src/lib/utils.ts`
- **Persistence:** IndexedDB / local snapshot; **Supabase** where configured (e.g. groups)
- **i18n:** `src/i18n.ts` — add keys for every new user-facing string

---

## 7. Release checklist (each slice)

- [ ] **PRD §3** row updated if template parity moved (Have / Partial / Need).
- [ ] **styleguide.md** followed for new UI.
- [ ] **i18n** for new copy.
- [ ] **`npm run build`**
- [ ] **Playwright smoke** `tests/e2e/smoke.spec.ts` with `--workers=1` if flaky.

---

## 8. Roadmap (Notion parity first)

| Priority | Track |
|----------|--------|
| **R1** | Assignments + To dos + Important links + home reminders / quick capture |
| **R2** | Meetings + Notes metadata + Cornell / Simple templates |
| **R3** | Passion projects |
| **R4** | Groups (Phase 7 depth), integrations, i18n, native shells (historical phases) |

---

## 9. Historical milestone snapshot (pre–Notion-checklist era)

Engineering previously tracked Phases 1–6 as **done**: foundation, LeetCode, Reading, Calendar, Notes & global polish, AI assistant, plus route lazy-loading and smoke tests. **Phase 7+** (groups depth, native, full i18n, launch audit) remains **ongoing or planned**—details in git history if needed.

---

## 10. Success criteria (product)

- Users describe the app as **easy to navigate** and **calm**.
- Home answers **what’s today / this week** without opening four tools.
- **Course-linked** work is visible at a glance (chips, filters, dashboard).
- Optional: match **Notion template** workflows as §3 checklist approaches all **Have**.

---

## Document history

| Date | Notes |
|------|--------|
| 2026-04-06 | Single **PRD.md** + **styleguide.md** split; Notion export checklist; removed separate PRODUCT_SPEC / implementation doc. |

*End of PRD.md*
