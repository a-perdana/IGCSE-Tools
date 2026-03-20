# IGCSE Tools — App Instructions

## What This Is

A React + TypeScript SPA for generating Cambridge IGCSE exam-quality assessments using AI (Gemini, OpenAI, Anthropic). Teachers upload past papers and syllabuses as reference, configure subject/topic/difficulty, and the app generates syllabus-aligned questions with mark schemes.

---

## Tech Stack

- **React 19** + **TypeScript 5.8** + **Vite 6**
- **Tailwind CSS 4** (via `@tailwindcss/vite` plugin)
- **Firebase 12** (modular SDK v10): Auth (Google Sign-In), Firestore, Cloud Storage
- **AI SDKs**: `@google/genai` (Gemini), OpenAI via `fetch`, Anthropic via `fetch`
- **Math rendering**: KaTeX via `rehype-katex` + `remark-math`
- **PDF export**: `html2canvas` + `jsPDF`

---

## Firebase Project

**Separate project from other Eduversal apps — `igcse-tools` (NOT `centralhub-8727b`)**

| Field | Value |
|---|---|
| projectId | igcse-tools |
| authDomain | igcse-tools.firebaseapp.com |
| storageBucket | igcse-tools.firebasestorage.app |
| Config file | `firebase-applet-config.json` (committed — public keys only) |

Deploy rules from this directory:
```bash
cd "IGCSE Tools"
firebase deploy --only firestore:rules,storage --project igcse-tools
```

---

## Collections

| Collection | Purpose | Access |
|---|---|---|
| `assessments` | Saved assessment batches | Owner RW; public read if `isPublic=true` |
| `questions` | Individual saved questions | Owner RW; public read if `isPublic=true` |
| `folders` | Grouping containers | Owner only |
| `resources` | Uploaded PDFs (past papers, syllabuses) | Owner RW; shared read if `isShared=true` |
| `syllabusCache` | Extracted syllabus topics (AI-processed) | Owner only |
| `pastPaperCache` | Extracted past paper examples | Owner only |

---

## API Keys

**No shared/fallback API key.** Each user provides their own key via the in-app API Settings panel. Keys are stored in `localStorage` only (never sent to any server other than the respective AI provider).

Supported providers (configured in `src/lib/providers.ts`):
- **Gemini** (Google) — recommended; free tier via Google AI Studio (no credit card)
- **OpenAI** — paid; new accounts get $5 credit
- **Anthropic** — paid; new accounts get $5 credit

Free tier info and step-by-step instructions are shown in the UI when no key is entered (`FREE_TIER_INFO` in `providers.ts`). Do NOT add a shared/fallback key to `.env` or `vite.config.ts`.

---

## Development Setup

```bash
cd "IGCSE Tools"
npm install
npm run dev          # Vite dev server on port 3000
npm run build        # Production build → dist/
npm run lint         # TypeScript type check
npm run test         # Vitest unit tests
```

No `.env` values are required for local development. Users provide API keys in-browser.

---

## Key Source Files

| File | Purpose |
|---|---|
| `src/lib/gemini.ts` | Gemini generation, audit, feedback, file upload; all prompts; `DIFFICULTY_GUIDANCE`, `SUBJECT_SPECIFIC_RULES`, `MARK_SCHEME_FORMAT`, `CAMBRIDGE_COMMAND_WORDS`, `ASSESSMENT_OBJECTIVES` |
| `src/lib/providers.ts` | Provider configs, model lists, `FREE_TIER_INFO` (free/paid badge + setup steps) |
| `src/lib/ai.ts` | Provider router (Gemini / OpenAI / Anthropic) |
| `src/lib/firebase.ts` | Firebase SDK init, all Firestore + Storage operations incl. GDPR `deleteUserData` |
| `src/lib/types.ts` | TypeScript interfaces — `QuestionItem` has `assessmentObjective`, `options` fields; `TikzSpec` has `diagramType:'tikz'`, `code`, `maxWidth` |
| `src/lib/sanitize.ts` | Post-generation question sanitization, normalises `assessmentObjective` |
| `src/lib/quicklatex.ts` | TikZ render client — sends code to `/api/latex` proxy; in-memory cache keyed on code string |
| `src/hooks/useGeneration.ts` | React hook: generation state + orchestration |
| `src/hooks/useResources.ts` | React hook: resource upload, caching, management |
| `src/components/Sidebar/` | Config sidebar, resource manager, API settings (free tier guidance) |
| `src/components/AssessmentView/` | Main question editor and viewer |
| `src/components/Library/` | Assessment / question library browser |
| `src/components/DiagramRenderer/` | Renders `TikzSpec` via Railway microservice; shows collapsible error+source on failure |
| `api/latex.ts` | Vercel Serverless Function (Node.js runtime, 60s timeout) — proxies to Railway |
| `latex-renderer/server.js` | **Separate git repo** (`a-perdana/Latex-Renderer`) deployed on Railway — pdflatex + pdftoppm → PNG |

---

## Deployment

- **Platform**: Vercel (automatic deploy on push to `main`)
- **Config**: `vercel.json` (CSP + security headers — includes Railway domain)
- **Build output**: `dist/` (gitignored)

### Diagram Rendering Pipeline

```
Browser → POST /api/latex (Vercel Serverless, 60s)
       → POST https://latex-renderer-production.up.railway.app/render
       → pdflatex → pdftoppm → PNG bytes
```

- `src/lib/quicklatex.ts` — `renderTikz(code)` sends to `/api/latex`, returns `{ url, width, height }`
- `api/latex.ts` — Vercel proxy (Node.js runtime, NOT Edge — needed for 60s timeout)
- `latex-renderer/server.js` — Railway microservice; `buildDocument()` wraps tikzpicture in `\documentclass[tikz]{standalone}`; always injects default libs: `calc, arrows.meta, angles, quotes, patterns, positioning`
- Stored `diagram.code` is always the raw `\begin{tikzpicture}...\end{tikzpicture}` block (no `\documentclass` wrapper)
- Railway repo: `c:/Users/maliu/Desktop/Eduversal Web/IGCSE Tools/latex-renderer/` — push to deploy

---

## Question Generation Architecture

Questions are generated in `src/lib/gemini.ts` via `generateTest()`:
1. **Phase 1 (Plan)**: Gemini decides question slots — topic, type, `hasDiagram` flag
2. **Phase 2 (Write)**: Two parallel batch calls:
   - `writeQuestionsWithTikz()` — diagram slots: writes question + `tikzCode` in one call (schema-enforced JSON)
   - `writeQuestionsWithoutDSL()` — non-diagram slots: standard batch
3. **Phase 4 (Critique)**: `critiqueAndRefine()` audits and rewrites low-quality questions
4. **Phase 4.5** (Challenging only): Auto-regeneration loop via `enforceQuestionQuality()`

**TikZ code flow:**
- `q.tikzCode` from Gemini → stored as `diagram: { diagramType: 'tikz', code: tikzCode }` on `QuestionItem`
- Gemini prompt: "Write ONLY `\begin{tikzpicture}...\end{tikzpicture}` block — NO `\documentclass`"
- Available libraries (always loaded): `calc, arrows.meta, angles, quotes, patterns, positioning`
- calc interpolation `$(A)!0.5!(B)$` is allowed and fully supported
- `generateTikzCode()` — used by Improve/Regenerate buttons; returns fenced-code-stripped text

**Repair path (Library):**
- Regenerate button → `regenerateDiagramsForQuestions()` → `generateTikzCode()` → `library.updateQuestion()` → Firestore + state
- Library `useEffect` syncs `previewQuestion` from `questions` prop after update so modal refreshes immediately

**Question fields:**
- `assessmentObjective`: `'AO1'` | `'AO2'` | `'AO3'` — Cambridge Assessment Objective
- `difficultyStars`: `1` | `2` | `3` — cognitive demand rating
- `syllabusObjective`: `"REF – statement"` format (e.g. `"C4.1 – Define the term acid"`)
- `type`: `'mcq'` | `'short_answer'` | `'structured'`
- Structured questions use **(a)**, **(b)**, **(c)** sub-part format with a shared context stem
- `diagram?: TikzSpec` — present when `hasDiagram: true`

---

## Security Notes

- **CSP headers** defined in `vercel.json` — update if new external domains are added
- **`syllabusCache` / `pastPaperCache`** Firestore rules: owner-only read (not world-readable)
- **GDPR `deleteUserData()`**: deletes Firestore docs AND Storage files under `resources/{uid}/`
- **`.env`** is intentionally empty — no secrets committed

---

## Common Mistakes

1. **Never add a shared/fallback API key** — keys must be user-provided only (security).
2. **Never commit `.env` with real API keys** — `.env` is gitignored and intentionally empty.
3. **Firestore rules must be redeployed** after editing `firestore.rules` — changes do NOT take effect automatically.
4. **Storage rules must be redeployed** separately if `storage.rules` changes.
5. This Firebase project (`igcse-tools`) is completely separate from `centralhub-8727b`.
6. **Adding a new AI provider**: update `providers.ts` (labels, models, URLs, `FREE_TIER_INFO`) AND add a new provider file in `src/lib/`, then wire it in `ai.ts`.
7. **`api/latex.ts` must use Node.js runtime** (not Edge) — `export const config = { maxDuration: 60 }` enables 60s timeout needed for pdflatex.
8. **latex-renderer is a separate git repo** — changes to `latex-renderer/server.js` must be committed and pushed from inside that directory, NOT from the IGCSE Tools repo root.
9. **Old assessments may have broken `diagram.code`** from the DSL era — use the Regenerate button (↻) in Library to fix them.
