# Notebook 2.0 — Product Requirements Document

> A beautiful, intuitive productivity notebook built for Computer Science students.

---

## 1. Vision & Purpose

Notebook 2.0 is a single, cohesive workspace where CS students can **track coding progress, retain knowledge from textbooks, and organize daily life** — all without context-switching between five different apps.

Today, a typical CS student juggles LeetCode, Notion, Google Calendar, Anki, and scattered markdown files. Notebook 2.0 replaces that fragmented workflow with one thoughtfully designed application that understands how CS students actually study and prepare for careers.

### Design Principles

| Principle | What it means |
|---|---|
| **Clarity over clutter** | Every screen earns its place. No feature bloat. |
| **Speed first** | Interactions should feel instant — keyboard-first, minimal clicks. |
| **Delight in progress** | Visual feedback (streaks, heatmaps, completion rings) that motivates without gamifying. |
| **Offline-capable** | Works without internet; syncs when reconnected. |
| **Dark mode native** | Designed for dark mode first (CS students live in dark mode), with a polished light variant. |

---

## 2. Target Users

### Primary Persona — "Alex"

- Junior CS student at a mid-tier university
- Grinding LeetCode for internship interviews (goal: 200 problems)
- Reading *Introduction to Algorithms* (CLRS) alongside coursework
- Needs to balance classes, study sessions, gym, and side projects
- Currently uses: LeetCode website, Apple Notes, Google Calendar, a spreadsheet

### Secondary Persona — "Priya"

- Graduate student doing research
- Reads 3-4 technical papers/textbooks per quarter
- Wants to extract and review key concepts systematically
- Tracks daily time allocation across research, coursework, and TA duties

### Out of Scope Users

- Professional developers (no Jira/sprint features)
- Non-technical students (no generic essay/writing tools)

---

## 3. Information Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          Notebook 2.0                            │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│          │          │          │          │          │          │
│  📊      │  📚      │  📅      │  📝      │  👥      │  🤖      │
│  LeetCode│  Reading │ Calendar │  Notes   │  Study   │  AI      │
│  Tracker │  Tracker │ &Schedule│  (Quick) │  Groups  │  Assist  │
│          │          │          │          │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
         ▲                                              ▲
         │          🔍 Global Search                    │
         │          ⌘K Command Palette                  │
         └──────────────────────────────────────────────┘
```

The app is organized into **six primary modules** accessible via a persistent sidebar. A global command palette (`⌘K` / `Ctrl+K`) allows instant navigation to any page, problem, book, or event. The AI Chat panel is accessible from any screen via a collapsible side panel.

---

## 4. Feature Specifications

---

### 4.1 LeetCode Progress Tracker

**Purpose:** Give students a clear, motivating view of their interview prep journey — what they've solved, where they're weak, and what to do next.

#### 4.1.1 Dashboard View

| Element | Description |
|---|---|
| **Progress Ring** | Large animated ring showing `solved / goal` (e.g., 127 / 200). Segmented by difficulty: Easy (green), Medium (amber), Hard (red). |
| **Streak Counter** | Current consecutive days with at least one problem solved. Flame icon with subtle animation. |
| **Heatmap** | GitHub-style contribution heatmap showing daily solve activity for the past 12 months. Color intensity maps to number of problems solved that day. |
| **Topic Radar Chart** | Spider/radar chart showing proficiency across topics (Arrays, Trees, DP, Graphs, etc.). Proficiency = (solved in topic / total available in topic) × acceptance rate weighting. |
| **Weekly Summary Card** | Problems solved this week, average time per problem, most-practiced topic, suggested focus area. |

#### 4.1.2 Problem Log

A searchable, sortable, filterable table of all logged problems.

| Column | Type | Details |
|---|---|---|
| # | Number | LeetCode problem number |
| Title | Text | Problem name (auto-linked to leetcode.com) |
| Difficulty | Tag | Easy / Medium / Hard — color-coded |
| Topics | Multi-tag | e.g., `Array`, `Two Pointers`, `Sliding Window` |
| Status | Select | ✅ Solved, 🔄 Attempted, 🔁 Review, ❌ Stuck |
| Date Solved | Date | Auto-populated, editable |
| Time (min) | Number | How long the attempt took |
| Approach | Rich text | Brief notes on the solution approach |
| Confidence | Rating | 1–5 stars — used for spaced repetition suggestions |
| Solution Link | URL | Link to personal solution (GitHub, etc.) |

**Interactions:**
- **Quick Add:** Press `N` to open a quick-add modal. Type problem number → auto-fetches title, difficulty, and topics via LeetCode's public data.
- **Bulk Import:** Paste a list of problem numbers or import from a CSV.
- **Filters:** Filter by difficulty, topic, status, confidence, date range.
- **Sort:** Click any column header. Default: most recent first.

#### 4.1.3 Spaced Repetition Suggestions

- Problems marked with confidence ≤ 3 are resurfaced on a spaced repetition schedule (1 day, 3 days, 7 days, 14 days, 30 days).
- A "Review Queue" section on the dashboard shows problems due for review today.
- Dismissing a review problem increases its interval; marking "still shaky" resets interval.

#### 4.1.4 Topic Deep-Dive Pages

- Clicking a topic (e.g., "Dynamic Programming") opens a dedicated page showing:
  - All problems in that topic, grouped by pattern (e.g., Knapsack, LIS, Matrix DP)
  - Completion percentage per pattern
  - Personal notes section for that topic (e.g., "Remember: always check if overlapping subproblems exist before going DP")
  - Curated resource links (optional, user-editable)

#### 4.1.5 LeetCode Auto-Import

The default workflow is manual entry, but users can optionally connect their LeetCode account for automatic syncing.

**Setup Flow:**
1. In LeetCode Tracker settings, user clicks "Connect LeetCode Account".
2. A modal prompts for their LeetCode username.
3. The app fetches their public profile and solved problem list via LeetCode's GraphQL API.
4. A confirmation screen shows what will be imported: total problems found, breakdown by difficulty, any conflicts with existing manual entries.
5. User confirms → data is merged into their problem log.

**Sync Behavior:**

| Aspect | Behavior |
|---|---|
| **Initial Import** | Fetches all historically solved problems. Auto-populates #, title, difficulty, topics, date solved (if available). Fields like approach, confidence, and time are left blank for user to fill. |
| **Ongoing Sync** | Background sync every 24 hours (configurable). New solves appear in a "Recently Imported" badge on the dashboard. |
| **Manual Override** | User can always edit auto-imported entries. Manual entries take precedence — if a conflict exists, manual data is preserved. |
| **Disconnect** | User can disconnect at any time in settings. Imported data remains; sync stops. |
| **Privacy** | Only public profile data is fetched. No LeetCode credentials are stored — username only. |

**Multi-Layer Sync Resilience:**

LeetCode's APIs are unofficial and may change. The sync system uses a layered approach to maximize reliability:

| Layer | Method | Details |
|---|---|---|
| **Primary** | LeetCode GraphQL API | Queries `userProfilePublicProfile`, `problemsetQuestionList`, and `recentSubmissionList` endpoints. Fastest and most structured data. |
| **Fallback 1** | HTML scraping | If GraphQL endpoints change or rate-limit, falls back to scraping the public profile page (`leetcode.com/u/{username}`). Extracts solved count, problem list, and submission history from rendered HTML. |
| **Fallback 2** | LeetCode public contest API | Supplements with contest history and rating data (separate, more stable endpoint). |
| **Manual Recovery** | CSV / JSON import | If all automated methods fail, users can export their LeetCode data manually and import via file upload. |

- The sync engine tries each layer in order, falling through on failure.
- A health monitor in Settings shows which sync method is currently active and its last success/failure timestamp.
- If the primary method fails for 3+ consecutive days, the user is notified with a suggestion to try manual import.

**UI Elements:**
- Settings panel: "LeetCode Integration" card with username field, sync status indicator, last sync timestamp, "Sync Now" button, and "Disconnect" button.
- Dashboard: "Auto-imported" badge on recently synced problems to distinguish from manual entries.
- Conflict resolution: If a manually logged problem is also found via auto-import, a subtle "verified" checkmark appears (confirming the solve matches LeetCode's records).

---

### 4.2 Reading & Knowledge Tracker

**Purpose:** Help students systematically extract, organize, and review key concepts from textbooks and technical books — turning passive reading into retained knowledge.

#### 4.2.1 Bookshelf View

A visual grid of books the student is currently reading or has finished.

| Element | Description |
|---|---|
| **Book Card** | Shows cover image (fetched via ISBN or manually uploaded), title, author, progress bar (chapters completed / total). |
| **Status Badge** | 📖 Reading, ✅ Completed, 📋 Planned |
| **Quick Stats** | "12 knowledge points captured" — shown on the card |

**Interactions:**
- **Add Book:** Enter title + author (or ISBN for auto-fill). Set total chapters.
- **Reorder:** Drag to reorder. Group by status.
- **Archive:** Move completed books to a separate "Completed" shelf.

#### 4.2.2 Book Detail / Knowledge Points Page

When a student opens a book, they see a structured knowledge extraction interface.

**Left Panel — Chapter Outline:**
- Expandable list of chapters (manually entered or via table-of-contents import).
- Each chapter shows a completion checkbox and count of captured knowledge points.
- Click a chapter to filter the right panel.

**Right Panel — Knowledge Points:**

Each knowledge point is a discrete, reviewable card:

| Field | Type | Details |
|---|---|---|
| Title | Text | Short summary (e.g., "Big-O of merge sort") |
| Chapter | Select | Which chapter this belongs to |
| Page/Section | Text | Optional page number or section reference |
| Concept | Rich text | Full explanation in the student's own words. Supports LaTeX math (`$O(n \log n)$`), code blocks, and diagrams. |
| Tags | Multi-tag | e.g., `Sorting`, `Complexity`, `Recursion` |
| Importance | Select | 🔴 Core concept, 🟡 Supporting detail, 🟢 Nice to know |
| Confidence | Rating | 1–5 — used for review scheduling |
| Connected To | Link | Link to related knowledge points (from this or other books) |

**Interactions:**
- **Quick Capture:** Press `K` while in a book view to quickly add a knowledge point. Minimal modal: just title + concept + auto-assigns current chapter.
- **Search:** Full-text search across all knowledge points in a book.
- **Export:** Export all knowledge points for a book as Markdown, PDF, or Anki-compatible flashcards.
- **Knowledge Graph (stretch):** A visual node graph showing connections between knowledge points within a book and across books.

#### 4.2.3 Cross-Book Knowledge Map

A unified view across all books:
- Search all knowledge points across all books
- Filter by tag, importance, confidence
- See "related concepts" grouped automatically (e.g., all entries tagged `Graph Algorithms` regardless of source)
- Identify gaps: topics mentioned but with no captured knowledge points

#### 4.2.4 Review Mode

- Flashcard-style review of knowledge points (shows title, student recalls concept, then reveals full card).
- Spaced repetition based on confidence ratings.
- Session summary: "You reviewed 15 cards. 3 need more work."

---

### 4.3 Calendar & Daily Schedule

**Purpose:** A focused, distraction-free calendar tailored to the rhythms of a CS student's day — classes, study blocks, coding sessions, and deadlines.

#### 4.3.1 Views

| View | Description |
|---|---|
| **Day** | Hour-by-hour timeline (6 AM – 12 AM default, adjustable). Shows events as colored blocks. Supports drag-to-create and drag-to-resize. |
| **Week** | 7-column grid. Each column is a day view. Current time indicated by a red horizontal line. |
| **Month** | Traditional month grid. Days show dot indicators for event density. Click a day to expand into day view. |
| **Agenda** | Vertical list of upcoming events, grouped by day. Best for scanning what's coming up. |

#### 4.3.2 Event Types

| Type | Color | Icon | Use Case |
|---|---|---|---|
| Class | Blue | 🎓 | Lectures, labs, office hours |
| Study Block | Green | 📗 | Dedicated study/reading time |
| LeetCode Session | Amber | ⚡ | Coding practice — auto-links to tracker |
| Deadline | Red | 🚨 | Assignment due dates, exam dates |
| Meeting | Purple | 👥 | Study groups, team meetings |
| Personal | Gray | 🏃 | Gym, meals, errands |
| Custom | User-pick | User-pick | Anything else |

#### 4.3.3 Recurring Events

- Support for daily, weekly, biweekly, and custom recurrence patterns.
- "This and following" vs. "Only this occurrence" editing.
- Academic quarter/semester templates: import a class schedule once, auto-populate the full term.

#### 4.3.4 Time Blocking & Focus

- **Focus Mode:** Selecting a study block or LeetCode session triggers a focus timer overlay (Pomodoro-style, configurable intervals).
- **Daily Summary:** At the top of the Day view, show a breakdown: "4h Class | 3h Study | 1h LeetCode | 2h Personal".
- **Weekly Hours Chart:** Small bar chart in the Week view footer showing hours per category.

#### 4.3.5 Integration Points

- **LeetCode Tracker:** Completing a LeetCode session event can prompt "Log problems solved during this session?"
- **Reading Tracker:** Study blocks linked to a specific book can prompt "Capture any new knowledge points?"
- **External Calendar Sync (stretch):** Import from Google Calendar / iCal via `.ics` file.

#### 4.3.6 Reminders & Notifications

- In-app notification bar for upcoming events (15 min, 1 hour, 1 day — configurable per event).
- Optional browser notifications (if running as web app).
- Daily digest: "Today you have 3 classes, 2 study blocks, and 1 deadline."

---

### 4.4 Quick Notes

**Purpose:** A lightweight, always-accessible scratchpad for capturing thoughts, code snippets, and ideas that don't yet belong in a specific module.

#### 4.4.1 Features

| Feature | Description |
|---|---|
| **Rich Text Editor** | Markdown-based with live preview. Supports headings, bold/italic, lists, checkboxes, code blocks (syntax-highlighted), LaTeX math, and image embeds. |
| **Quick Capture** | Global shortcut (`⌘+Shift+N`) opens a floating capture window from anywhere in the app. |
| **AI Paste Assist** | When a user pastes a large text block, show a small non-blocking popup offering AI summarization. User can choose output style (bullet knowledge points or paragraph summary), then choose insertion behavior (replace original block or insert summary below original content). |
| **Tagging** | Apply tags to notes for organization. Tags are shared across modules. |
| **Pinning** | Pin important notes to the top of the list. |
| **Linking** | Link notes to LeetCode problems, knowledge points, or calendar events using `[[wikilink]]` syntax. |
| **Search** | Full-text search with highlighting. |

#### 4.4.2 Note Templates

Pre-built templates for common CS student needs:
- **Lecture Notes** — Date, course, topic, key takeaways, action items
- **Algorithm Notes** — Problem, approach, time/space complexity, code, edge cases
- **Meeting Notes** — Date, attendees, agenda, decisions, follow-ups
- **Weekly Reflection** — What went well, what didn't, goals for next week

#### 4.4.3 AI Paste Assist (Large Paste Summarizer)

**Trigger condition:**
- Detect large pasted content in Notes editor (default threshold: > 800 characters or > 8 lines, configurable).
- Show a compact popup near the editor toolbar after paste:
  - "Summarize this pasted content?"

**User choices (step-by-step):**
1. **Summary format**
   - **Bullet Knowledge Points** (concise list, study-oriented)
   - **Paragraph Summary** (narrative condensed form)
2. **Insertion behavior (after generation)**
   - **Replace original pasted block**
   - **Insert summary below original block**

**Output behavior:**
- AI-generated output is shown in preview before final insert.
- User must explicitly confirm apply; no silent auto-overwrite.
- Preserve undo/redo history so user can revert instantly.

**UX requirements:**
- Keep popup visually lightweight and non-intrusive.
- Respect global AI settings:
  - AI off → no prompt shown.
  - BYOK selected with missing key → show inline setup warning.
- Follow `styleguide.md` for spacing, borders, popup styling, button hierarchy, and focus states.

---

### 4.5 Study Groups & Collaboration

**Purpose:** While the app defaults to a single-player experience, CS students often study together — taking the same class, prepping for the same interview cycle, or working on group projects. Study Groups bring lightweight, opt-in collaboration without cluttering the solo workflow.

#### 4.5.1 Group Creation & Management

| Element | Description |
|---|---|
| **Create Group** | Give it a name (e.g., "CS 161 Study Group", "Interview Prep Squad"), an optional description, and a group icon/color. |
| **Invite** | Generate a shareable invite link or invite by email/username. Links expire after 7 days (configurable). |
| **Roles** | **Owner** (full control), **Member** (can share, view shared content). Owners can promote members or remove them. |
| **Group Limit** | Max 20 members per group (keeps it intimate and performant). |
| **Leave/Delete** | Members can leave anytime. Owners can delete the group (members are notified). |

#### 4.5.2 Shared Spaces

Each study group has a shared workspace with the following tabs:

**Shared Problem Lists:**
- Members can publish a curated list of LeetCode problems to the group (e.g., "Must-do DP problems for midterm").
- Each shared list shows which group members have completed which problems — a lightweight leaderboard without pressure.
- Members can clone a shared list into their personal tracker with one click.

**Shared Notes:**
- Members can publish notes to the group. Published notes are read-only copies; the author retains the editable original.
- Group members can comment on shared notes (threaded comments).
- Useful for sharing lecture notes, algorithm explanations, or project documentation.

**Shared Knowledge Points:**
- When reading the same textbook, members can share their captured knowledge points into a group "knowledge pool."
- Other members see contributions tagged by author. Duplicate concepts are auto-detected and grouped.
- Members can import others' knowledge points into their personal collection.

**Group Progress Dashboard:**
- Aggregated view: total problems solved by the group this week, most active member, most popular topic.
- Individual opt-in: members choose whether their activity is visible to the group (privacy toggle per group).

#### 4.5.3 Group Calendar

- A shared calendar layer that overlays on each member's personal calendar.
- Used for scheduling study sessions, group meetings, project deadlines.
- Events created in the group calendar appear with a group badge on each member's personal calendar.
- RSVP support: members can accept/decline group events.

#### 4.5.4 Real-Time Presence (Stretch)

- See which group members are currently online and what module they're in.
- "Study Together" mode: a shared focus timer where all participants see the same countdown — creates virtual co-working accountability.

#### 4.5.5 Privacy & Boundaries

- All sharing is explicitly opt-in. Nothing from a user's personal workspace is visible to groups unless they intentionally publish it.
- Users control visibility per group: they can hide their LeetCode stats, reading progress, or calendar from any specific group.
- Group data is stored separately from personal data — deleting a group does not affect personal entries.

---

### 4.6 AI Study Assistant

**Purpose:** An intelligent, context-aware assistant that helps students learn more effectively — providing hints, explanations, study plans, and concept breakdowns. Powered by Claude (via [claw-agent-devtools](https://github.com/instructkr/claw-code)) as the underlying AI engine.

> The AI assistant is **off by default** and can be toggled on/off at any time in Settings → AI Features. When disabled, the app functions as a purely manual tracking tool with zero AI involvement.

#### 4.6.1 AI Toggle & Settings

| Setting | Description |
|---|---|
| **Master Toggle** | Enable / disable all AI features globally. Off by default. |
| **Per-Feature Toggles** | Granular control: enable AI for LeetCode hints but disable for reading, or vice versa. |
| **AI Model Selector** | Default: a free, capable model (see AI Cost Model below). Users can switch to Claude or other premium models by entering their own API key. |
| **API Key Input** | Optional field to enter a personal API key (Claude, OpenAI, etc.). Keys are encrypted at rest and never logged. When a key is provided, all AI calls use the user's key with no rate limits. |
| **Usage Indicator** | Show how many AI queries have been made this session/week, and which model was used (transparency). |
| **Data Privacy Notice** | Clear disclosure: what data is sent to the AI, what stays local. Shown on first enable. |

**AI Cost Model:**

| Tier | Model | Cost | Limits |
|---|---|---|---|
| **Free (default)** | Free-tier model (e.g., Gemma 3, Llama 4 Scout via Groq/Together, or Mistral free tier) | $0 to operate | Rate-limited: ~50 AI queries/day. Sufficient for hints, explanations, and light usage. |
| **Bring Your Own Key (BYOK)** | Claude (Anthropic), GPT (OpenAI), or any OpenAI-compatible API | User pays their provider directly | No rate limits from our side. Full access to all AI features. Recommended for heavy users. |

- The free model is selected to balance quality and zero operational cost. It is swappable — as better free models emerge, we update the default.
- BYOK users enter their API key in Settings → AI → API Key. The key is stored encrypted in their user profile and used server-side (or client-side for desktop apps).
- The AI engine (claw-agent-devtools) abstracts across providers, so switching models requires zero code changes — just a config update.
- A clear banner in the AI chat panel shows which model is active: "Powered by Gemma 3 (free)" or "Powered by Claude 4 (your API key)".

#### 4.6.2 LeetCode AI Features

**Hint System (Progressive Hints):**
- When viewing a problem they're stuck on, the student can click "Get a Hint."
- Hints are delivered progressively (Hint 1: high-level approach direction → Hint 2: key data structure/algorithm → Hint 3: pseudocode outline). The student controls how deep they go.
- Hints are context-aware: the AI sees the problem title, difficulty, topics, and any notes the student has already written in the "Approach" field.

**Solution Explanation:**
- After solving a problem, the student can click "Explain My Approach" and paste their solution code.
- The AI provides: time/space complexity analysis, edge cases they may have missed, alternative approaches, and how this problem connects to patterns they've studied.

**Study Plan Generator:**
- Based on the student's topic radar chart, confidence ratings, and goals (e.g., "I have 30 days until my Google interview"), the AI generates a personalized daily study plan.
- The plan is editable and can be pushed to the Calendar as study blocks.

**Pattern Recognition:**
- After solving several problems in a topic, the AI can summarize the common patterns the student has encountered (e.g., "You've solved 8 sliding window problems — here's the template they all share").

#### 4.6.3 Reading & Knowledge AI Features

**Concept Explainer:**
- From any knowledge point, the student can click "Explain Further."
- The AI provides a deeper explanation, real-world analogies, and related concepts — tailored to CS students.
- Supports follow-up questions in a conversational thread.

**Knowledge Gap Detector:**
- The AI analyzes captured knowledge points for a book and suggests topics the student may have missed or under-documented.
- "You've captured 12 points on graph algorithms but nothing on minimum spanning trees — Chapter 23 covers this. Want to add it?"

**Summarizer:**
- Select a chapter and click "AI Summary" to get a concise summary of the knowledge points captured so far, organized by importance.
- Useful for exam review: generates a one-page study sheet from your own notes.

**Flashcard Generator:**
- The AI can auto-generate flashcard question/answer pairs from knowledge points.
- Student reviews and edits before adding to the review queue.

#### 4.6.4 Calendar AI Features

**Smart Scheduling:**
- "I need to study 10 hours of algorithms this week" → AI distributes study blocks across available time slots, respecting existing events and preferred study hours.
- Suggests optimal study times based on past usage patterns (e.g., "You're most productive between 2–5 PM").

**Daily Briefing:**
- Optional AI-generated morning summary: "Today you have 2 classes, a study block for CLRS Chapter 15, and 3 LeetCode problems due for review. Based on your pace, you're on track for your 200-problem goal by May."

#### 4.6.5 AI Chat Panel

- A collapsible side panel (right edge of the app) that provides a general-purpose AI chat interface.
- Context-aware: the AI knows which module/page the student is on and can reference their data.
- Example queries:
  - "What's the difference between BFS and DFS for shortest path?"
  - "Quiz me on the knowledge points I captured from CLRS Chapter 4"
  - "What LeetCode problems should I do to practice Dijkstra's algorithm?"
- Conversation history is persisted per session and searchable.

#### 4.6.6 Notes AI Features

**Large Paste Summarizer:**
- In Notes, AI can summarize oversized pasted text with a compact decision flow.
- Formats:
  - Bullet knowledge points
  - Paragraph summary
- Post-generation actions:
  - Replace original content
  - Insert summary below original content
- Must preserve editing safety (preview + confirm + undo support).

#### 4.6.7 Technical Integration

The AI layer is built on [claw-agent-devtools](https://github.com/instructkr/claw-code), an open-source agent harness that provides:

- **API abstraction:** Provider-agnostic API client supporting Claude and other models via a unified interface.
- **Streaming responses:** Real-time token streaming for a responsive chat experience.
- **Context management:** Intelligent context windowing to keep requests within token limits while preserving relevant student data.
- **Tool use:** The AI can invoke structured actions (e.g., "add this problem to your tracker", "create a calendar event") through the claw-agent-devtools tool framework.
- **Local-first option:** For privacy-conscious users, support for local model inference via Ollama as a stretch goal.

---

### 4.7 Multi-Platform Distribution & Mobile Experience

**Purpose:** CS students are on the move — between classes, at the library, on the bus. The app must be available as a native download on every platform students use, with a seamless, native-feeling experience.

#### 4.7.1 Platform Distribution

| Platform | Technology | Distribution |
|---|---|---|
| **Web** | React SPA (primary codebase) | Hosted web app at notebook2.app (or similar) |
| **iOS** | Capacitor (wraps the web app in a native shell) | Apple App Store |
| **Android** | Capacitor (wraps the web app in a native shell) | Google Play Store |
| **macOS** | Electron (or Tauri for lightweight builds) | Direct download (.dmg) + Mac App Store |
| **Windows** | Electron (or Tauri) | Direct download (.exe / .msi) + Microsoft Store |
| **Linux** | Electron (or Tauri) | AppImage / .deb / Snap |

**Why Capacitor for Mobile:**
- Shares 95%+ of the React codebase with the web version — one team, one codebase.
- Native access to push notifications, biometric auth, camera (for book cover scanning), and file system.
- Native app store presence for discoverability and trust.

**Why Electron/Tauri for Desktop:**
- Desktop app provides system tray integration, global hotkeys (e.g., `⌘Shift+N` to quick-capture from anywhere), and offline-first local storage.
- Tauri is preferred for its smaller binary size (~5MB vs Electron's ~80MB), but Electron is the fallback for broader plugin support.

#### 4.7.2 Offline & Sync

- **Offline support:** Full CRUD functionality offline via IndexedDB (Dexie.js). Data syncs to the cloud when reconnected.
- **Conflict resolution:** Last-write-wins for simple fields; merge for rich text (CRDT-based, stretch goal).
- **Native storage:** On desktop, data is also persisted to the local filesystem for fast startup.

#### 4.7.3 Notification System

Configurable in **Settings → Notifications**:

| Notification Type | Default | Description |
|---|---|---|
| **Daily Digest** | On (8:00 AM) | "Today: 2 classes, 1 study block, 3 problems due for review." |
| **Event Reminders** | On (15 min before) | Configurable per-event: 5 min, 15 min, 30 min, 1 hour, 1 day. |
| **Streak Reminder** | On (8:00 PM) | "You haven't solved a problem today — keep your 12-day streak alive!" |
| **Review Due** | Off | "You have 5 knowledge points and 3 LeetCode problems due for review." |
| **Group Activity** | Off | "Alex shared a new problem list in 'CS 161 Study Group'." |
| **Weekly Summary** | On (Sunday 6:00 PM) | "This week: 14 problems solved, 8 knowledge points captured, 12 hours studied." |

**Implementation:**
- **Web:** Browser Push Notifications via the Web Push API + service worker.
- **Mobile (iOS/Android):** Native push notifications via Capacitor Push Notifications plugin (APNs for iOS, FCM for Android).
- **Desktop:** System-native notifications via Electron/Tauri notification APIs.
- Notification preferences stored per-user in the database, synced across all devices.
- Quiet hours setting: suppress all notifications between configurable hours (default: 11 PM – 7 AM).
- Per-group notification controls: mute specific groups without disabling group notifications entirely.

#### 4.7.3 Mobile-Optimized Views

| Module | Mobile Adaptation |
|---|---|
| **Dashboard** | Vertically stacked cards. Progress ring prominently at top. |
| **LeetCode Tracker** | Problem log switches to card layout (instead of table). Swipe-left to change status. |
| **Reading Tracker** | Bookshelf becomes a horizontal scroll. Knowledge points in expandable accordion. |
| **Calendar** | Day view is default on mobile. Agenda view accessible via tab. Week/month behind a toggle. |
| **Notes** | Full-width editor. Toolbar collapses to a floating action button. |
| **AI Chat** | Full-screen overlay instead of side panel. |

---

## 5. Global Features

### 5.1 Command Palette (`⌘K` / `Ctrl+K`)

- Instant fuzzy search across all content: problems, books, knowledge points, events, notes.
- Quick actions: "Add LeetCode problem", "New note", "Go to today's calendar", "Open book: CLRS".
- Recent items for fast switching.

### 5.2 Global Search

- Unified search bar in the top navigation.
- Results grouped by module (LeetCode, Reading, Calendar, Notes).
- Supports filters: `type:leetcode difficulty:hard topic:dp`.

### 5.3 Dashboard / Home

The landing page when opening the app. A personalized daily briefing:

| Section | Content |
|---|---|
| **Good morning, Alex** | Greeting with today's date |
| **Today's Schedule** | Compact view of today's calendar events |
| **LeetCode Streak** | Current streak + problems due for review |
| **Reading Progress** | Currently reading book + recent knowledge points |
| **Quick Actions** | Buttons: "Solve a problem", "Read", "New note" |

### 5.4 Theming

- **Dark mode** (default): Deep charcoal background (`#0d1117`), soft white text, accent colors per module.
- **Light mode**: Clean white background, subtle gray borders, same accent colors.
- Accent color customizable (default: electric blue `#58a6ff`).

### 5.5 Keyboard Shortcuts

The app is fully navigable via keyboard.

| Shortcut | Action |
|---|---|
| `⌘K` | Command palette |
| `⌘1–6` | Switch to module (1=Dashboard, 2=LeetCode, 3=Reading, 4=Calendar, 5=Notes, 6=Groups) |
| `N` | New item (context-aware: new problem, knowledge point, event, or note) |
| `⌘Shift+N` | Quick note capture |
| `⌘Shift+A` | Toggle AI chat panel |
| `/` | Focus search bar |
| `?` | Show all shortcuts |

---

## 6. UI/UX Design Guidelines

> Detailed visual source of truth is `styleguide.md`. Where this section conflicts with `styleguide.md`, the style guide document takes precedence.

### 6.1 Layout

```
┌──────────────────────────────────────────────────────────────┐
│  ┌──────┐                              🔍  🌐  ⚙️  👤      │
│  │ Logo │   Global Search Bar                     [lang]     │
│  └──────┘                                                    │
├────────┬────────────────────────────────────────┬────────────┤
│        │                                        │            │
│  🏠    │                                        │  🤖 AI     │
│  Home  │                                        │  Chat      │
│        │                                        │  Panel     │
│  📊    │                                        │            │
│  Code  │       Main Content Area                │  (collaps- │
│        │                                        │   ible)    │
│  📚    │   (changes based on selected module)   │            │
│  Read  │                                        │            │
│        │                                        │            │
│  📅    │                                        │            │
│  Cal   │                                        │            │
│        │                                        │            │
│  📝    │                                        │            │
│  Notes │                                        │            │
│        │                                        │            │
│  👥    │                                        │            │
│  Groups│                                        │            │
│        │                                        │            │
├────────┤                                        │            │
│  ⚙️    │                                        │            │
│  Set.  │                                        │            │
└────────┴────────────────────────────────────────┴────────────┘
```

- **Sidebar:** 60px wide (icon-only), expandable to 220px on hover/pin. Collapsible on mobile.
- **Content Area:** Max-width 1200px, centered, with comfortable padding.
- **Responsive:** Fully responsive down to tablet. Mobile-friendly with bottom navigation bar.

### 6.2 Typography

| Use | Font | Weight | Size |
|---|---|---|---|
| Headings | Inter | 600 (SemiBold) | 24–32px |
| Body | Inter | 400 (Regular) | 14–16px |
| Code | JetBrains Mono | 400 | 13–14px |
| Captions | Inter | 400 | 12px, muted color |

### 6.3 Color System

| Token | Dark Mode | Light Mode | Usage |
|---|---|---|---|
| `--bg-primary` | `#0d1117` | `#ffffff` | App background |
| `--bg-secondary` | `#161b22` | `#f6f8fa` | Cards, sidebar |
| `--bg-tertiary` | `#21262d` | `#eaeef2` | Inputs, hover states |
| `--text-primary` | `#e6edf3` | `#1f2328` | Main text |
| `--text-secondary` | `#8b949e` | `#656d76` | Subtitles, captions |
| `--border` | `#30363d` | `#d0d7de` | Borders, dividers |
| `--accent` | `#58a6ff` | `#0969da` | Links, active states |
| `--success` | `#3fb950` | `#1a7f37` | Easy, completed |
| `--warning` | `#d29922` | `#9a6700` | Medium, in-progress |
| `--danger` | `#f85149` | `#cf222e` | Hard, deadlines |
| `--purple` | `#bc8cff` | `#8250df` | Meetings, special |

### 6.4 Component Library

Build on a consistent set of reusable components:

- **Button:** Primary (filled accent), Secondary (outlined), Ghost (text-only), Danger
- **Card:** Elevated surface with subtle border, hover shadow lift
- **Badge/Tag:** Rounded pill with background tint
- **Modal:** Centered overlay with backdrop blur
- **Toast:** Bottom-right notification with auto-dismiss
- **Tooltip:** Delay 300ms, arrow-anchored
- **Table:** Alternating row tints, sticky header, sortable columns
- **Input:** Underline-on-focus style, floating label

### 6.5 Motion & Animation

- **Page transitions:** Subtle fade + 4px upward slide (150ms, ease-out)
- **Card hover:** 2px elevation increase + border highlight (100ms)
- **Progress ring:** Smooth fill animation on load (600ms, ease-in-out)
- **Heatmap:** Staggered tile fade-in on first render (30ms delay per tile)
- **Micro-interactions:** Checkbox fills with a satisfying "pop"; streak counter increments with a bounce

---

## 7. Technical Architecture

### 7.1 Recommended Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | React 18 + TypeScript | Component-based, large ecosystem, type safety |
| **Styling** | Tailwind CSS + Radix UI | Utility-first with accessible primitives |
| **State** | Zustand | Lightweight, minimal boilerplate |
| **Charts** | Recharts or Nivo | React-native charting for heatmaps, radars |
| **Rich Text** | Tiptap (ProseMirror) | Extensible, markdown-compatible editor |
| **Calendar** | Custom (date-fns) | Full control over calendar UX |
| **Routing** | React Router v6 | Standard SPA routing |
| **Build** | Vite | Fast HMR, optimized builds |
| **Backend** | Supabase (PostgreSQL + Auth) | Hosted DB, auth, real-time — minimal backend code |
| **Real-Time** | Supabase Realtime (WebSockets) | Group collaboration, presence, live sync |
| **Storage** | Supabase Storage | Book covers, image uploads |
| **Offline** | IndexedDB (Dexie.js) | Local-first data with sync |
| **Mobile** | Capacitor | Wraps React SPA into native iOS/Android apps. Access to native push, camera, biometrics. |
| **Desktop** | Tauri (preferred) or Electron | Native desktop apps for macOS, Windows, Linux. System tray, global hotkeys, local storage. |
| **Notifications** | APNs (iOS) + FCM (Android) + Web Push API | Native push on mobile, browser push on web, system notifications on desktop. |
| **AI Engine** | claw-agent-devtools | Open-source agent harness — streaming, tool use, context management, provider-agnostic. |
| **AI Default Model** | Free-tier LLM (Gemma 3 / Llama 4 Scout / Mistral) | Zero-cost default via Groq, Together, or Mistral free APIs. |
| **AI BYOK** | Claude, GPT, or any OpenAI-compatible API | Users bring their own API key for premium models with no rate limits. |
| **Deployment** | Vercel (web) + App Store + Play Store + direct download (desktop) | Multi-channel distribution. |
| **i18n** | react-i18next + ICU MessageFormat | Internationalization framework for multi-language support. |

### 7.2 Data Models (Simplified)

```
User
├── id, email, name, avatar, theme_preference, locale (default: "en"), created_at
├── ai_enabled (boolean), ai_model (free | byok), ai_api_key (encrypted, nullable)
├── notification_preferences (json)
├── leetcode_username (nullable), leetcode_last_sync (timestamp), leetcode_sync_method (graphql | scrape | manual)

LeetCodeProblem
├── id, user_id, problem_number, title, difficulty, topics[], status
├── date_solved, time_minutes, approach (rich text), confidence (1-5)
├── solution_link, next_review_date, review_interval
├── source (manual | auto_import), verified (boolean)

Book
├── id, user_id, title, author, isbn, cover_url, total_chapters
├── status (reading | completed | planned), created_at

KnowledgePoint
├── id, book_id, user_id, title, chapter, page_section
├── concept (rich text), tags[], importance, confidence (1-5)
├── connected_points[], next_review_date, review_interval

CalendarEvent
├── id, user_id, title, type, color, start_time, end_time
├── recurrence_rule, description, linked_module, linked_item_id
├── reminder_offsets[], group_id (nullable)

Note
├── id, user_id, title, content (rich text), tags[], pinned
├── template_type, linked_items[], created_at, updated_at

StudyGroup
├── id, name, description, icon_color, created_by, created_at
├── invite_code, invite_expires_at, max_members (default: 20)

GroupMembership
├── id, group_id, user_id, role (owner | member), joined_at
├── visibility_settings (json: show_leetcode, show_reading, show_calendar)
├── notification_muted (boolean)

SharedItem
├── id, group_id, author_id, item_type (problem_list | note | knowledge_point)
├── title, content (json), created_at
├── source_item_id (reference to original personal item)

GroupComment
├── id, shared_item_id, author_id, content (text)
├── parent_comment_id (nullable, for threading), created_at

AIConversation
├── id, user_id, context_module, context_item_id (nullable)
├── messages (json array), created_at, updated_at

NotificationPreference
├── id, user_id, type (daily_digest | event_reminder | streak | review | group)
├── enabled (boolean), time (time), quiet_hours_start, quiet_hours_end
├── push_subscription (json, Web Push endpoint)
```

### 7.3 Performance Targets

| Metric | Target |
|---|---|
| First Contentful Paint | < 1.2s |
| Time to Interactive | < 2.0s |
| Lighthouse Score | > 90 (all categories) |
| Bundle Size (gzipped) | < 200KB initial |
| Offline Capability | Full CRUD without network |

---

## 8. Non-Functional Requirements

| Requirement | Specification |
|---|---|
| **Authentication** | Email/password + GitHub OAuth + Google OAuth + Apple Sign-In (required for iOS App Store). |
| **Authorization** | Personal data is private by default. Group-shared data visible only to group members. |
| **Data Privacy** | User data never sold. GDPR-compliant data export/deletion. AI data disclosure on first enable. |
| **Accessibility** | WCAG 2.1 AA. Full keyboard navigation. Screen reader support. Formal audit after Phase 8. |
| **Browser Support** | Chrome, Firefox, Safari, Edge (latest 2 versions). |
| **Mobile** | Native apps on iOS (App Store) and Android (Play Store) via Capacitor. Full offline support, native push notifications. |
| **Desktop** | Native apps for macOS, Windows, and Linux via Tauri/Electron. System tray, global hotkeys. |
| **Data Export** | Export all data as JSON or Markdown at any time. |
| **Backup** | Daily automated database backups with 30-day retention. |
| **Monetization** | Free to use. Future commercialization path via premium features (TBD post-launch based on adoption). Core features remain free. |
| **AI Privacy** | Clear disclosure of what data is sent to AI models. AI features are opt-in with granular toggles. No user data used for model training. API keys encrypted at rest. |
| **AI Cost** | Free default model (rate-limited). BYOK option for unlimited premium AI. |
| **Real-Time** | WebSocket-based real-time sync for group features (presence, shared lists, group calendar). |
| **Internationalization** | Full i18n support. Launch languages: English, Chinese (Simplified), Korean, Hindi, Spanish. Community-contributed translations welcome. |
| **App Store Compliance** | Adheres to Apple App Store Review Guidelines and Google Play Developer Policies. |

---

## 9. Milestones & Roadmap

### Phase 1 — Foundation (Weeks 1–4)

- [x] Project scaffolding (Vite + React + TypeScript + Tailwind)
- [x] Design system: color tokens, typography, core components (Button, Card, Input, Modal)
- [x] Auth flow (sign up, sign in, sign out, forgot password — GitHub + Google + Apple OAuth)
- [x] Sidebar navigation + routing + bottom nav (mobile)
- [x] Dashboard / Home page (static layout)
- [x] Settings page skeleton (theme toggle, notification prefs, AI toggle, API key input)
- [x] i18n framework setup (react-i18next, English as base locale, extraction pipeline)

### Phase 2 — LeetCode Tracker (Weeks 5–9)

- [x] Problem log CRUD (add, edit, delete problems)
- [x] Problem table with search, sort, filter
- [x] Dashboard: progress ring, streak counter, heatmap
- [x] Topic radar chart + topic deep-dive pages
- [x] Spaced repetition engine + review queue
- [x] LeetCode auto-import: username input, GraphQL fetch, initial sync
- [x] Multi-layer sync resilience (GraphQL → HTML scraping → CSV fallback)
- [x] Ongoing sync (24h background), conflict resolution, "verified" badge, sync health monitor
- [x] Mobile card layout for problem log

### Phase 3 — Reading & Knowledge Tracker (Weeks 10–14)

- [x] Bookshelf view (add books, progress tracking)
- [x] Knowledge point CRUD with rich text + LaTeX + code blocks
- [x] Chapter outline navigation
- [x] Cross-book knowledge map + tag-based grouping
- [x] Flashcard review mode with spaced repetition
- [x] Mobile-optimized bookshelf (horizontal scroll) and accordion knowledge points
- [x] Export: Markdown, PDF, Anki-compatible flashcards

### Phase 4 — Calendar & Schedule (Weeks 15–19)

- [x] Day, Week, Month, Agenda views
- [x] Event CRUD with drag-to-create, drag-to-resize
- [x] Event types with color coding
- [x] Recurring events + academic term templates
- [x] Focus mode timer (Pomodoro)
- [x] Integration hooks (LeetCode session → log problems, Study block → capture knowledge)
- [x] Push notification system: daily digest, event reminders, streak reminders
- [x] Quiet hours, per-event reminder configuration
- [x] Mobile-first day/agenda views

### Phase 5 — Quick Notes & Global Polish (Weeks 20–23)

- [x] Rich text note editor (Tiptap) with code blocks, LaTeX, images
- [x] Note templates (Lecture Notes, Algorithm Notes, Meeting Notes, Weekly Reflection)
- [x] `[[Wikilink]]` system for cross-module linking
- [x] Global search + command palette (`⌘K`)
- [x] Full keyboard shortcut system
- [x] Dark/light theme toggle with accent color customization
- [x] Offline support: IndexedDB local storage, background sync
- [x] Performance optimization (code splitting, lazy loading, bundle analysis)

#### Pre-Phase 6 Hardening Improvements (non-blocking, added Apr 2026)

- [x] Split major pages into route-level lazy chunks (move each page to dedicated modules for smaller initial JS payload).
- [x] Add e2e smoke checks for critical pre-Phase 6 flows (auth, LeetCode sync, Reading CRUD, Calendar event CRUD, Notes save/search).
- [x] Add accessibility sanity pass before AI expansion (focus order, ARIA naming on mobile nav/cards, color contrast check).

### Phase 6 — AI Study Assistant (Weeks 24–28)

- [x] AI settings: master toggle, per-feature toggles, privacy disclosure
- [x] Free default model integration (Gemma 3 / Llama 4 Scout via Groq or Together)
- [x] BYOK (Bring Your Own Key): API key input, encrypted storage, model selector
- [x] Integrate claw-agent-devtools as AI backend (provider-agnostic abstraction)
- [x] AI Chat panel: collapsible side panel, context-aware, conversation history
- [x] Active model indicator banner ("Powered by ___")
- [x] LeetCode AI: progressive hints, solution explanation, pattern recognition
- [x] Reading AI: concept explainer, knowledge gap detector, chapter summarizer
- [x] Flashcard auto-generation from knowledge points
- [x] Calendar AI: smart scheduling, daily briefing generation
- [x] Study plan generator (goal-based, pushed to calendar)
- [x] Notes AI paste assist: large-paste popup, format choice (bullet/paragraph), apply mode (replace/insert-below)
- [x] Streaming responses for responsive UX
- [x] Rate limiting for free-tier users (~50 queries/day)

### Phase 7 — Study Groups & Collaboration (Weeks 29–34)

- [ ] Group creation, invite links, member management, roles
- [ ] Shared problem lists with group-wide completion tracking
- [ ] Shared notes with threaded comments
- [ ] Shared knowledge points (group knowledge pool)
- [ ] Group progress dashboard (aggregated stats, opt-in visibility)
- [ ] Group calendar (shared events, RSVP, overlay on personal calendar)
- [ ] Real-time sync via Supabase Realtime (WebSockets)
- [ ] Per-group privacy controls and notification muting
- [ ] Group activity notifications

### Phase 8 — Native Apps & Platform Distribution (Weeks 35–40)

- [ ] Capacitor integration: wrap React SPA for iOS and Android
- [ ] Native push notifications (APNs for iOS, FCM for Android)
- [ ] iOS-specific: Apple Sign-In, App Store review compliance, TestFlight beta
- [ ] Android-specific: Play Store listing, Android adaptive icons, beta track
- [ ] Desktop app: Tauri (or Electron) builds for macOS (.dmg), Windows (.exe), Linux (AppImage)
- [ ] Desktop features: system tray, global hotkey for quick capture, auto-update
- [ ] Cross-device sync testing (web ↔ mobile ↔ desktop)
- [ ] App Store and Play Store submissions

### Phase 9 — Internationalization (Weeks 41–44)

- [ ] Complete i18n string extraction across all modules (all user-facing text wrapped in `t()`)
- [ ] Professional translations: Chinese (Simplified), Korean, Hindi, Spanish
- [ ] Language selector in Settings with auto-detection based on browser/OS locale
- [ ] RTL layout support (foundation for future Arabic/Hebrew)
- [ ] Date, time, and number format localization (locale-aware `date-fns`)
- [ ] Localized App Store and Play Store listings
- [ ] Community translation contribution pipeline (Crowdin or Weblate)

### Phase 10 — Launch, Polish & Audit (Weeks 45–48)

- [ ] Formal WCAG 2.1 AA accessibility audit (third-party or automated tooling)
- [ ] Accessibility remediation based on audit findings
- [ ] End-to-end testing (Playwright) across web, mobile simulators, and desktop
- [ ] User testing with 30+ CS students across 3+ countries, iterate on feedback
- [ ] Performance profiling and optimization across all platforms
- [ ] Landing page + documentation site
- [ ] Product Hunt launch
- [ ] Community Discord / GitHub Discussions
- [ ] App Store & Play Store marketing assets (screenshots, descriptions, keywords)

### Stretch Goals (Post-Launch)

- [ ] Knowledge graph visualization (interactive node graph across books)
- [ ] Google Calendar / iCal sync (import/export `.ics`)
- [ ] Local AI via Ollama for fully offline, private AI inference on desktop
- [ ] "Study Together" real-time co-working mode with shared focus timer
- [ ] Browser extension for capturing knowledge points from web articles
- [ ] LeetCode contest tracking and performance analytics
- [ ] Anki sync (two-way) instead of just export
- [ ] GitHub integration: link solutions to repos, track commits alongside LeetCode progress
- [ ] Customizable dashboard widgets (drag-and-drop layout)
- [ ] Spaced repetition analytics (retention curves, optimal review intervals)
- [ ] Additional languages (Japanese, Portuguese, French, German, Arabic)
- [ ] iPad / Android tablet optimized layouts
- [ ] Watch companion app (Apple Watch / Wear OS) for streak and reminder glances
- [ ] Premium tier exploration (cloud storage upgrades, advanced AI models, priority support)

---

## 10. Success Metrics

| Metric | Target (3 months post-launch) |
|---|---|
| Total downloads (all platforms) | 5,000+ |
| Weekly active users | 40% of total downloads |
| Avg. problems logged per active user | 5+ per week |
| Avg. knowledge points per active user | 3+ per week |
| Calendar events created | 10+ per user per week |
| Study groups created | 200+ |
| AI feature adoption (among enabled users) | 60%+ weekly usage |
| BYOK API key registrations | 15% of AI-enabled users |
| App Store rating (iOS) | > 4.5 ★ |
| Play Store rating (Android) | > 4.5 ★ |
| User retention (30-day) | > 50% |
| NPS Score | > 40 |
| Product Hunt upvotes | Top 5 of the day |
| Non-English users | 20%+ of total |

---

## 11. Resolved Decisions

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | **LeetCode data:** Auto-import or manual only? | **Both.** Manual entry by default. Optional auto-import via LeetCode username. | Lowers friction for power users while keeping the app functional without any external dependency. See §4.1.5. |
| 2 | **Collaboration:** Single-player or multiplayer? | **Single-player default with opt-in Study Groups.** | Students studying alone shouldn't see collaboration complexity. But classmates, study partners, and project teams benefit from shared problem lists, notes, and calendars. See §4.5. |
| 3 | **Mobile priority:** PWA now or later? | **Native apps from Phase 8.** iOS (App Store), Android (Play Store), macOS, Windows, Linux. | A downloadable app builds trust, enables native push notifications, and is the path to commercialization. See §4.7. |
| 4 | **Monetization:** Paid or free? | **Free to use, with future commercialization.** Core features are free. Premium tier explored post-launch. | Maximizes initial adoption among price-sensitive students. Commercialization decisions deferred until product-market fit is proven. |
| 5 | **AI features:** Include or exclude? | **Include, but off by default with granular toggles.** Free default model + BYOK for premium. | AI dramatically enhances studying. Free model keeps it accessible; BYOK lets power users unlock premium models. See §4.6. |
| 6 | **Self-hosting:** Docker Compose for self-hosting? | **No.** The product is a downloadable app (mobile + desktop), not a self-hosted service. | Self-hosting fragments the user base and complicates support. Native apps with offline-first architecture address the privacy concern. |
| 7 | **LeetCode API stability:** Fallback for unofficial API? | **Multi-layer sync: GraphQL → HTML scraping → CSV import.** | LeetCode's APIs are unstable. A resilient fallback chain ensures sync works regardless. See §4.1.5. |
| 8 | **AI cost model:** Who pays for AI? | **Free default model (rate-limited) + BYOK (unlimited).** | Free model (Gemma 3 / Llama 4 Scout) costs $0 to operate. BYOK users pay their own provider. Zero AI cost on our infrastructure. See §4.6.1. |
| 9 | **Accessibility audit:** When? | **After Phase 10 (final launch phase).** | Auditing after all features are built avoids redundant re-audits. Accessibility best practices are followed throughout; the formal audit catches remaining gaps. |
| 10 | **i18n:** Internationalize? | **Yes. Phase 9 (Weeks 41–44).** Launch with English, Chinese, Korean, Hindi, Spanish. | CS is a global field. Localization dramatically expands the addressable market, especially in Asia. See Phase 9 in roadmap. |

---

## 12. Appendix

### A. Competitive Landscape

| App | Strengths | Gaps (that Notebook 2.0 fills) |
|---|---|---|
| **Notion** | Flexible, databases | No LeetCode-specific features, slow, heavy |
| **LeetCode (native)** | Problem data | No personal tracking, no study schedule integration |
| **Anki** | Spaced repetition | No book tracking, not a notebook, ugly UI |
| **Google Calendar** | Calendar | No study-specific features, no knowledge tracking |
| **Obsidian** | Markdown, linking | Steep learning curve, no structured trackers |
| **ChatGPT / Claude** | AI explanations | No tracking, no persistence, no student-specific workflow |

### B. User Research Signals

- Reddit r/cscareerquestions: 50+ threads about "how do you track LeetCode progress?"
- Common answer: spreadsheets, Notion templates, custom scripts
- Pain points: context-switching, lack of spaced repetition, no unified view of study progress

---

*Last updated: April 4, 2026 (v3 — native app distribution, AI cost model, i18n, all questions resolved)*
*Author: Notebook 2.0 Team*
