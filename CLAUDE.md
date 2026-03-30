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
| `practiceAttempts` | Practice session results | Owner only |
| `examAttempts` | Exam session results | Owner only |
| `sharedAssignments` | Teacher-shared assignments (class mode) | Teacher RW; students read by join code |

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
| `src/lib/gemini.ts` | Gemini generation, audit, feedback, file upload. Imports constants/validators from `prompts.ts` and `validation.ts` and re-exports them for backward compat. |
| `src/lib/prompts.ts` | All prompt constants: `IGCSE_SUBJECTS`, `IGCSE_TOPICS`, `DIFFICULTY_LEVELS`, `DIFFICULTY_GUIDANCE`, `CAMBRIDGE_COMMAND_WORDS`, `ASSESSMENT_OBJECTIVES`, `SUBJECT_SPECIFIC_RULES`, `MARK_SCHEME_FORMAT`, etc. |
| `src/lib/validation.ts` | Question quality validators extracted from gemini.ts: `enforceQuestionQuality`, `isTooEasy`, `hasMultiStepStructure`, `requiresGeometricUse`, etc. |
| `src/lib/pricing.ts` | Cost estimation: `estimateCostUSD()`, `estimateCostIDR()`, `formatCost(usd, currency)` (supports `'IDR'`\|`'USD'`), `MODEL_PRICING` |
| `src/lib/providers.ts` | Provider configs, model lists, `FREE_TIER_INFO` (free/paid badge + setup steps) |
| `src/lib/ai.ts` | Provider router (Gemini / OpenAI / Anthropic). Functions: `generateTest`, `auditTest`, `checkPracticeAnswer` (also used for exam grading), `getQuestionHint`, `analyzeFile`. |
| `src/lib/firebase.ts` | Firebase SDK init, all Firestore + Storage operations incl. GDPR `deleteUserData`, `savePracticeAttempt`, `saveExamAttempt`, `getPracticeAttempts`, `getExamAttempts` |
| `src/lib/types.ts` | TypeScript interfaces — `QuestionItem`, `PracticeAnswerRecord` / `ExamAnswerRecord` (both have `criteriaBreakdown?: CriterionResult[]` and `syllabusObjective?`), `CriterionResult`, `PracticeAttempt`, `ExamAttempt`, `SharedAssignment`, `AssignmentAttempt` |
| `src/lib/sanitize.ts` | Post-generation question sanitization — MCQ downgrades to `short_answer` if < 4 valid options; normalises `assessmentObjective`; extracts TikZ from fenced blocks |
| `src/lib/quicklatex.ts` | TikZ render client — sends code to `/api/latex` proxy; in-memory cache keyed on code string |
| `src/lib/__tests__/` | Vitest unit tests: `pricing.test.ts`, `sanitize.test.ts`, `svg.test.ts`, `clipboard.test.ts` |
| `src/hooks/useGeneration.ts` | React hook: generation state + orchestration. Handles `Timestamp \| number` union for `geminiFileUploadedAt`. |
| `src/hooks/useResources.ts` | React hook: resource upload, caching, management |
| `src/hooks/usePractice.ts` | Practice session state. Uses `sessionRef` to avoid stale closures. Exports: `checkAnswer`, `getHint`, `finishSession`, `goToQuestion`. Session has `hints`, `isHinting` fields. |
| `src/hooks/useExamMode.ts` | Exam session state. Countdown timer, auto-submit, parallel grading via `Promise.all` (MCQ instant + AI concurrent). Session has `showCountdownWarning` (≤10s), `dismissCountdownWarning()`. |
| `src/components/Sidebar/` | Config sidebar, resource manager, API settings. Has currency toggle (IDR/USD, persisted to `localStorage`), API key test button (pings provider REST endpoint). |
| `src/components/AssessmentView/` | Main question editor and viewer |
| `src/components/Library/` | Assessment / question library browser. Accepts `weakTopicFilter?: {topic, subject}` prop — auto-filters to that topic when set (used by ProgressDashboard spaced repetition). |
| `src/components/Library/modals.tsx` | Extracted modal components: `ImportedPreviewModal`, `QuestionPreviewModal`, `ConfirmDeleteModal`, `ExamViewImportModal`. Also exports `QMarkdown`, `importedToQuestionItem`, `DeleteTarget`. |
| `src/components/PracticeMode/` | Practice session UI. `PracticeQuestion` shows: command word badge + guidance box, `~X min` time hint, question grid navigator (violet/green/amber), Check Answer + 💡 Hint buttons, criteria breakdown in feedback. |
| `src/components/ExamMode/` | Exam session UI. `ExamQuestion` shows command word badge + `~X min` hint. 10-second countdown warning modal. `ExamResults` shows criteria breakdown + comparative answer view (your answer vs correct). |
| `src/components/ProgressDashboard/` | Progress analytics. Shows topic accuracy, weak/strong topics, recent sessions, **weak syllabus objectives** (from `syllabusObjective` saved on each answer record). `onPracticeWeakTopic` callback navigates Library with filter. |
| `src/components/DiagramRenderer/` | Renders `TikzSpec` via Railway microservice; shows visible warning banner (not collapsed) on render failure |
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
- `syllabusObjective`: `"REF – statement"` format (e.g. `"C4.1 – Define the term acid"`) — also saved on `PracticeAnswerRecord` / `ExamAnswerRecord` at finish time for analytics
- `commandWord`: Cambridge command word (e.g. `"Explain"`, `"Calculate"`) — shown as badge in Practice/Exam with a one-line guidance hint
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

## Practice & Exam Mode Architecture

### Practice Mode (`usePractice` + `PracticeMode/`)
- **Session state** uses `sessionRef` (useRef) to mirror `useState` — all async callbacks (`checkAnswer`, `getHint`, `finishSession`) read from `sessionRef.current` to avoid stale closure bugs.
- **`setSessionSafe`** wraps `setSession` to keep `sessionRef` in sync on every update.
- **`checkAnswer`**: MCQ → client-side instant; short_answer/structured → `checkPracticeAnswer()` from `ai.ts`.
- **`getHint`**: calls `getQuestionHint()` from `ai.ts` — returns a 2-3 sentence nudge without revealing the mark scheme.
- **`finishSession`**: auto-checks unchecked MCQ drafts; tags `syllabusObjective` on all answer records before saving.
- **Submit flow**: "Submit All & Finish" button appears when all questions have a draft answer (even if not AI-checked).

### Exam Mode (`useExamMode` + `ExamMode/`)
- **Grading is parallel**: MCQ + empty answers graded instantly (client-side), then all AI questions run via `Promise.all`.
- **`showCountdownWarning`** becomes `true` when ≤10 seconds remain; dismissed by `dismissCountdownWarning()`.
- **`syllabusObjective`** is attached to every `ExamAnswerRecord` at grading time.

### Answer Records (`PracticeAnswerRecord` / `ExamAnswerRecord`)
Both types share these optional fields (added 2026-03-30):
- `criteriaBreakdown?: CriterionResult[]` — per-mark AI breakdown (`{criterion, awarded}`)
- `syllabusObjective?: string` — copied from `QuestionItem` at save time; used by `ProgressDashboard` for objective-level analytics

### ProgressDashboard
- **Topic accuracy**: aggregate marks per topic across all attempts.
- **Syllabus objective accuracy**: per-`syllabusObjective` accuracy (only for attempts saved after 2026-03-30 — older attempts lack this field).
- **Spaced repetition**: "Practice →" button on weak topics calls `onPracticeWeakTopic(topic, subject)` → `App.tsx` sets `libraryWeakTopicFilter` → `Library` auto-applies topic + subject filter.

---

## Common Mistakes

1. **Never add a shared/fallback API key** — keys must be user-provided only (security).
2. **Never commit `.env` with real API keys** — `.env` is gitignored and intentionally empty.
3. **Firestore rules must be redeployed** after editing `firestore.rules` — changes do NOT take effect automatically.
4. **Storage rules must be redeployed** separately if `storage.rules` changes.
5. This Firebase project (`igcse-tools`) is completely separate from `centralhub-8727b`.
6. **Adding a new AI provider**: update `providers.ts` (labels, models, URLs, `FREE_TIER_INFO`) AND add a new provider file in `src/lib/`, then wire it in `ai.ts`. Also add provider branch to `checkPracticeAnswer` and `getQuestionHint` in `ai.ts`.
7. **`api/latex.ts` must use Node.js runtime** (not Edge) — `export const config = { maxDuration: 60 }` enables 60s timeout needed for pdflatex.
8. **latex-renderer is a separate git repo** — changes to `latex-renderer/server.js` must be committed and pushed from inside that directory, NOT from the IGCSE Tools repo root.
9. **Old assessments may have broken `diagram.code`** from the DSL era — use the Regenerate button (↻) in Library to fix them.
10. **`geminiFileUploadedAt` is `Timestamp | number`** — always use `typeof val === 'number' ? val : val.toMillis()` before arithmetic. Never do `Date.now() - Timestamp` directly.
11. **Prompt constants live in `prompts.ts`, validators in `validation.ts`** — do NOT add them back to `gemini.ts`. Both are re-exported from `gemini.ts` for backward compat.
12. **MCQ questions require exactly 4 non-empty options** — `sanitize.ts` downgrades to `short_answer` otherwise. The `options` field is only present on `QuestionItem` when `type === 'mcq'` and all 4 options are valid.
13. **Modal components live in `Library/modals.tsx`** — do not inline new modals in `Library/index.tsx`.
14. **`usePractice` callbacks must use `setSessionSafe` not `setSession`** — `setSessionSafe` keeps `sessionRef` in sync; using raw `setSession` breaks `finishSession` and `getHint` which read from ref.
15. **`criteriaBreakdown` is only present for AI-checked answers** — MCQ answers and "Not checked" answers do not have this field. Always guard with `?`.
16. **`syllabusObjective` on answer records is only present for attempts saved after 2026-03-30** — older `practiceAttempts`/`examAttempts` documents lack it; handle missing field gracefully in analytics.

<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->
