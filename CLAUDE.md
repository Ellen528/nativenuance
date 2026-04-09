# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # Install dependencies
npm run dev       # Start Vite dev server (port 3000)
npm run build     # Production build to /dist
npm run preview   # Preview production build locally
```

There are no test commands — this project has no test suite.

## Architecture

**WordDecode** is a single-page React + TypeScript app (Vite) that uses Google Gemini AI to help advanced English learners deconstruct text into vocabulary with native speaker context. It uses Supabase for auth, database, and Edge Functions.

### Key Layers

**`services/`** — All business logic and external API calls:
- `geminiService.ts` — Calls Supabase Edge Functions which proxy Gemini API requests
- `dataService.ts` — All Supabase database operations (CRUD for analyses, vocabulary, flashcards, folders)
- `sm2Algorithm.ts` — SuperMemo SM-2 spaced repetition implementation
- `pdfService.ts` — PDF parsing via pdfjs-dist
- `authService.ts` / `supabaseClient.ts` — Auth helpers

**`components/`** — UI only, no direct API calls. Key components:
- `AnalysisView.tsx` — Displays extracted vocabulary after text analysis
- `FlashcardReview.tsx` — SM-2 flashcard interface with keyboard shortcuts
- `HistoryView.tsx` — Saved analyses, folder organization
- `FullTextView.tsx` — Interactive text with double-click inline word lookup
- `BookLibrary.tsx` / `BookCatalog.tsx` / `ChapterView.tsx` — eBook reading and analysis

**`supabase/functions/`** — Deno Edge Functions (deployed to Supabase):
- `analyze-text/` — Main vocabulary extraction from text
- `generate-practice/` — Practice scenario generation
- `extract-book-structure/` — Book/PDF chapter parsing
- `extract-phrasal-verbs/` — Specialized phrasal verb extraction for books
- `generate-vocabulary/` — Vocabulary generation for manually entered terms

**`App.tsx`** — Root component (~1000+ lines), manages top-level state and routing between `AppMode` views.

**`types.ts`** — Central type definitions. All enums and interfaces live here.

### Data Persistence (Hybrid)

The app uses a **local-first** approach:
- **LocalStorage** — analyses, folders, user proficiency, known words (always available)
- **Supabase** — cloud sync when authenticated; same data mirrored to PostgreSQL

When reading/writing data, check `dataService.ts` — it handles both paths and syncs between them.

### State Management

- Local `useState` per component for UI state
- `AuthContext` (in `contexts/AuthContext.tsx`) for auth state globally
- No Redux or Zustand — props drilling for data, context only for auth

### AI Integration Pattern

Gemini API is never called directly from the frontend. All AI calls go:
`geminiService.ts` → Supabase Edge Function → Gemini API

Edge functions are in `supabase/functions/`. If changing AI prompts or models, edit the edge functions, not the frontend service file.

### Vocabulary Categories (Core Domain Concept)

Vocabulary is classified into these categories (defined in `types.ts` as `VocabularyCategory`):
- `phrasal_verbs` — multi-word verbs
- `idioms_fixed` — fixed idiomatic expressions
- `nuance_sarcasm` — nuanced/tone-dependent usage
- `chunks_structures` — common sentence chunks/collocations
- `topic_specific` — domain vocabulary

This categorization drives filtering in `AnalysisView` and flashcard separation between text analysis vs. book library vocabulary.
