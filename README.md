# EASE Studio

AI-assisted Cambridge **item authoring** studio for the Eduversal Academic Board.

Subject Specialists use it to draft assessment items — question, mark scheme, and diagram —
across Cambridge stages (Lower Secondary Checkpoint → IGCSE → AS & A Level), then review and
refine them before they enter the network's formal item banks.

> **Boundary:** EASE Studio is an *authoring* surface. It does not deliver assessments to
> students and does not write to any grading record. Delivery lives in Students Hub;
> scheduling lives in Teachers Hub; the formal item banks live in Central Hub.

---

## What it does

| Capability | Notes |
|---|---|
| **AI item generation** | Plan → write → critique → quality-enforce pipeline. Cambridge command words, assessment objectives (AO1–AO3), and per-subject rules are encoded in `src/lib/prompts.ts`. |
| **Deterministic maths** | All geometry is computed in `src/lib/mathEngine.ts` — never by the model. The AI only writes wording. |
| **TikZ diagrams** | `\begin{tikzpicture}` → Railway `pdflatex` microservice → PNG. |
| **PDF diagram extraction** | Lift figures out of past papers into a reusable diagram pool. |
| **ExamView import** | Parse Blackboard-format ZIP exports into structured items. |
| **Reference upload** | Past papers and syllabuses as generation context, cached per resource. |

## Stack

React 19 · TypeScript 5.8 · Vite 6 · Tailwind CSS 4 · Firebase 12 (Auth + Firestore + Storage)

```bash
npm install
npm run dev     # http://localhost:3000
npm run lint    # tsc --noEmit
npm run test    # vitest
npm run build   # → dist/
```

No `.env` values are needed — each user supplies their own AI provider key in-app.

## Infrastructure note

The Firebase project id is **`igcse-tools`** and stays that way: Firebase project ids are
permanent, and the `authDomain` / `storageBucket` names derive from it. It is an internal
identifier only — it is never shown to users. Do not create a replacement project to "fix"
the name; that would mean migrating Auth, Firestore, and Storage for a cosmetic gain.

See [`CLAUDE.md`](CLAUDE.md) for architecture, collections, and the common-mistakes list.
