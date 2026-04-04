# Notebook 2.0

Notebook app for CS students, built from `PRD.md`.

## Getting Started

```bash
npm install
npm run dev
```

## Current Status

Phase 1 + Phase 2 in progress:

- React + TypeScript + Vite scaffold
- App shell with routing for Dashboard, LeetCode, Reading, Calendar, Notes, Groups, Settings
- Base design tokens and dark-mode-first styling
- Settings skeleton for AI toggle, notifications, LeetCode username, and API key input
- i18n baseline (`react-i18next`) with English locale
- Typed domain models for LeetCode, books, events, and groups
- Zustand app store with Dexie/IndexedDB persistence and hydration
- Real LeetCode Problem Log CRUD UI (add, edit, delete, search, filters)
- Settings fully wired to saved preferences (AI, notifications, theme, username, API key)
