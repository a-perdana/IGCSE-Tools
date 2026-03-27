import { GoogleGenAI, Type } from "@google/genai";
import type {
  QuestionItem,
  Assessment,
  AnalyzeFileResult,
  GenerationConfig,
  GeminiError,
  TikzSpec,
  DiagramPoolEntry,
  RasterSpec,
} from "./types";
import type { Reference, PastPaperItem } from "./ai";
import type { UsageCallback } from "./ai";
import {
  sanitizeQuestion,
  generateQuestionCode as sharedGenerateQuestionCode,
} from "./sanitize";
import { parseJsonWithRecovery } from "./json";
import {
  IGCSE_SUBJECTS,
  IGCSE_TOPICS,
  DIFFICULTY_LEVELS,
  DIFFICULTY_GUIDANCE,
  CAMBRIDGE_COMMAND_WORDS,
  ASSESSMENT_OBJECTIVES,
  SUBJECT_SPECIFIC_RULES,
  MARK_SCHEME_FORMAT,
  PAST_PAPER_FOCUS,
  SUBJECT_CODES,
  DIFFICULTY_CODES,
} from "./prompts";
import {
  hasMultiStepStructure,
  requiresGeometricUse,
  hasCognitiveLoad,
  isAStarLevel,
  requiresDiagramExtraction,
  enforceQuestionQuality,
  isTooEasy,
} from "./validation";

// Re-export constants so all existing callers of '../lib/gemini' continue to work
export {
  IGCSE_SUBJECTS,
  IGCSE_TOPICS,
  DIFFICULTY_LEVELS,
  DIFFICULTY_GUIDANCE,
  CAMBRIDGE_COMMAND_WORDS,
  ASSESSMENT_OBJECTIVES,
  SUBJECT_SPECIFIC_RULES,
  MARK_SCHEME_FORMAT,
  PAST_PAPER_FOCUS,
};
// Re-export validation helpers (enforceQuestionQuality is used externally)
export { enforceQuestionQuality };

function getAI(apiKey?: string) {
  if (!apiKey) {
    throw {
      type: "unknown",
      retryable: false,
      message:
        "No Gemini API key provided. Please add your key in API Settings.",
    };
  }
  return new GoogleGenAI({ apiKey });
}


// Re-export shared helper so callers can still import generateQuestionCode from gemini
export { sharedGenerateQuestionCode as generateQuestionCode };

/** Deterministic short hash — no Math.random(). */
function deterministicId(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(36).toUpperCase().padStart(4, "0").substring(0, 4);
}

export function generateAssessmentCode(
  subject: string,
  difficulty: string,
): string {
  const subj = SUBJECT_CODES[subject] ?? subject.substring(0, 3).toUpperCase();
  const diff =
    DIFFICULTY_CODES[difficulty] ?? difficulty.substring(0, 3).toUpperCase();
  const shortId = deterministicId(`${subject}-${difficulty}-${Date.now()}`);
  return `${subj}-${diff}-${shortId}`;
}

// ---- Error handling ----

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  onRetry?: (attempt: number) => void,
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.status ?? err?.code;

      // Rate limit (429) — exponential backoff: 15s, 30s, 60s
      if (status === 429) {
        if (i < maxRetries - 1) {
          onRetry?.(i + 1);
          await new Promise((r) => setTimeout(r, Math.pow(2, i + 1) * 7500));
          continue;
        }
        throw {
          type: "rate_limit",
          retryable: false,
          message:
            "Rate limit exceeded. Please wait a few minutes and try again.",
        } satisfies GeminiError;
      }

      // Model overloaded (503) — retry with backoff
      if (status === 503) {
        if (i < maxRetries - 1) {
          onRetry?.(i + 1);
          await new Promise((r) => setTimeout(r, Math.pow(2, i) * 5000));
          continue;
        }
        throw {
          type: "model_overloaded",
          retryable: false,
          message:
            "Model is currently overloaded. Try switching to a Flash model.",
        } satisfies GeminiError;
      }

      // Not found (404) — no retry
      if (status === 404) {
        throw {
          type: "unknown",
          retryable: false,
          message:
            "Model not found (404). Check your model selection — the selected model may not exist or your API key may not have access to it.",
        } satisfies GeminiError;
      }

      // Auth errors — no retry
      if (status === 401 || status === 403) {
        throw {
          type: "unknown",
          retryable: false,
          message:
            "Invalid or unauthorized API key. Please check your key in API Settings.",
        } satisfies GeminiError;
      }

      // Invalid response / JSON / MAX_TOKENS — retry with short delay
      if (status === 422 || err?.type === "invalid_response") {
        if (i < maxRetries - 1) {
          onRetry?.(i + 1);
          await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
          continue;
        }
        throw {
          type: "invalid_response",
          retryable: true,
          message:
            err?.message ??
            "Model returned an incomplete response. Please retry.",
        } satisfies GeminiError;
      }

      // Preserve original error message if available
      console.error('[gemini] unhandled error', { status, err })
      const originalMsg =
        err?.message && !err.message.startsWith("{") ? err.message : null;
      const jsonMsg = err?.message?.startsWith("{")
        ? (() => { try { return JSON.parse(err.message)?.[0]?.error?.message ?? null } catch { return null } })()
        : null
      throw {
        type: "unknown",
        retryable: false,
        message: originalMsg ?? jsonMsg ?? `Generation failed (status ${status ?? 'unknown'}). Please try again.`,
      } satisfies GeminiError;
    }
  }
  throw {
    type: "rate_limit",
    retryable: false,
    message: "Rate limit exceeded. Please wait a few minutes and try again.",
  } satisfies GeminiError;
}
// -------------------------

// 48h minus 2h buffer
const GEMINI_URI_VALID_MS = 46 * 60 * 60 * 1000;

/** Safely convert a Firestore Timestamp or plain ms number to milliseconds. */
function toMs(val: import('firebase/firestore').Timestamp | number): number {
  return typeof val === 'number' ? val : val.toMillis()
}

const FILE_UPLOAD_TIMEOUT_MS = 120_000; // 2 minutes max for a file upload

export async function uploadToGeminiFileApi(
  base64: string,
  mimeType: string,
  displayName: string,
  apiKey: string,
): Promise<string> {
  const ai = getAI(apiKey);
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            `File upload timed out after ${FILE_UPLOAD_TIMEOUT_MS / 1000}s. Check your connection or try a smaller file.`,
          ),
        ),
      FILE_UPLOAD_TIMEOUT_MS,
    ),
  );

  const uploaded = await Promise.race([
    ai.files.upload({ file: blob, config: { displayName, mimeType } }),
    timeoutPromise,
  ]);
  return (uploaded as any).uri as string;
}

function buildReferenceParts(
  references: Reference[],
  difficulty?: string,
  syllabusOnly?: boolean,
): any[] {
  const parts: any[] = [];
  const pastPapers = references.filter((r) => r.resourceType === "past_paper");
  const syllabuses = references.filter((r) => r.resourceType === "syllabus");
  const others = references.filter(
    (r) => !r.resourceType || r.resourceType === "other",
  );

  if (!syllabusOnly && pastPapers.length > 0) {
    const focusInstruction = difficulty
      ? (PAST_PAPER_FOCUS[difficulty] ?? "")
      : "";
    parts.push({
      text: `REFERENCE PAST PAPERS (${pastPapers.length} document${pastPapers.length > 1 ? "s" : ""}): The following are authentic Cambridge IGCSE past papers. Study them carefully and replicate their exact question style, phrasing, command word usage, diagram style, and mark allocation patterns. Your generated questions MUST feel indistinguishable from these official papers.\n\n${focusInstruction}`,
    });
    pastPapers.forEach((ref) => {
      if (ref.pastPaperText) {
        // Use cached text extraction — much cheaper than sending the full PDF
        parts.push({
          text: `PAST PAPER STYLE EXAMPLES (extracted):\n${ref.pastPaperText}`,
        });
      } else if (
        ref.geminiFileUri &&
        ref.geminiFileUploadedAt &&
        Date.now() - toMs(ref.geminiFileUploadedAt) < GEMINI_URI_VALID_MS
      ) {
        parts.push({
          fileData: { fileUri: ref.geminiFileUri, mimeType: ref.mimeType },
        });
      } else {
        parts.push({
          inlineData: {
            mimeType: ref.mimeType,
            data: ref.data.split(",")[1] || ref.data,
          },
        });
      }
    });
  }

  if (syllabuses.length > 0) {
    syllabuses.forEach((ref) => {
      if (ref.syllabusText) {
        parts.push({
          text: `OFFICIAL CAMBRIDGE IGCSE SYLLABUS OBJECTIVES:\nOnly generate questions that directly assess the following learning objectives. Every question must be explicitly aligned to a stated objective.\n\n${ref.syllabusText}`,
        });
      } else {
        parts.push({
          text: `OFFICIAL CAMBRIDGE IGCSE SYLLABUS: The following document is the official syllabus. Only generate questions that cover the stated learning objectives. Every question must be aligned to a specific objective listed in this syllabus.`,
        });
        if (
          ref.geminiFileUri &&
          ref.geminiFileUploadedAt &&
          Date.now() - toMs(ref.geminiFileUploadedAt) < GEMINI_URI_VALID_MS
        ) {
          parts.push({
            fileData: { fileUri: ref.geminiFileUri, mimeType: ref.mimeType },
          });
        } else {
          parts.push({
            inlineData: {
              mimeType: ref.mimeType,
              data: ref.data.split(",")[1] || ref.data,
            },
          });
        }
      }
    });
  }

  if (!syllabusOnly && others.length > 0) {
    others.forEach((ref) => {
      if (
        ref.geminiFileUri &&
        ref.geminiFileUploadedAt &&
        Date.now() - toMs(ref.geminiFileUploadedAt) < GEMINI_URI_VALID_MS
      ) {
        parts.push({
          fileData: { fileUri: ref.geminiFileUri, mimeType: ref.mimeType },
        });
      } else {
        parts.push({
          inlineData: {
            mimeType: ref.mimeType,
            data: ref.data.split(",")[1] || ref.data,
          },
        });
      }
    });
  }

  return parts;
}

/** Fixes formatting, LaTeX, and wording issues in an existing question without changing its content.
 *  Used by the UI "Repair" button. */
export async function repairQuestionText(
  question: QuestionItem,
  subject: string,
  model: string = "gemini-2.0-flash",
  apiKey?: string,
): Promise<Partial<QuestionItem> | null> {
  const ai = getAI(apiKey);

  const prompt = `You are proofreading a Cambridge IGCSE ${subject} exam question. Fix ONLY formatting and LaTeX issues — do NOT change the meaning, difficulty, or content.

COMMON ISSUES TO FIX:
- Broken LaTeX: e.g. "$\\text{ cm}$$" → "$\\text{cm}$", "$$5.8 \\text{ cm}$$" → "$5.8\\text{ cm}$"
- Double dollar signs where single should be used inline
- Missing or extra spaces inside math mode
- Inconsistent notation (e.g. mix of $x$ and x)
- MCQ option lines that start with "A)" but contain raw LaTeX artifacts
- Mark scheme lines with broken math formatting
- Currency/price dollar signs misread as LaTeX math: e.g. "AB = $4.415\ncm.Triangle DEF..." → the "$4.415" is a price, not math. Fix: "AB = 4.415 cm. Triangle DEF..."
- Sentences running together without spaces or line breaks — add proper spacing and newlines
- Text that has been accidentally italicised or formatted as math — restore to plain text

QUESTION TEXT:
${question.text}

ANSWER:
${question.answer}

MARK SCHEME:
${question.markScheme}

Return JSON with exactly these fields (fix all three, return original if nothing to fix):
{
  "text": "...",
  "answer": "...",
  "markScheme": "..."
}`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    });
    const raw = response.text?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      text?: string;
      answer?: string;
      markScheme?: string;
    };
    const updates: Partial<QuestionItem> = {};
    if (parsed.text && parsed.text !== question.text)
      updates.text = parsed.text;
    if (parsed.answer && parsed.answer !== question.answer)
      updates.answer = parsed.answer;
    if (parsed.markScheme && parsed.markScheme !== question.markScheme)
      updates.markScheme = parsed.markScheme;
    return Object.keys(updates).length > 0 ? updates : null;
  } catch {
    return null;
  }
}

/** Used by the UI "Regenerate Diagram" button — regenerates diagrams for already-written questions.
 *  This is the repair path, not the main generation path. */
export async function regenerateDiagramsForQuestions(
  questions: QuestionItem[],
  subject: string,
  model: string = "gemini-2.0-flash",
  apiKey?: string,
  _onUsage?: UsageCallback,
  onLog?: (msg: string) => void,
  renderErrors?: Record<string, string>,
): Promise<Array<{ id: string; diagram: TikzSpec }>> {
  const ai = getAI(apiKey);
  const results = await Promise.all(
    questions.map(async (q) => {
      const renderError = renderErrors?.[q.id];
      const tikzCode = await generateTikzCode(
        q,
        subject,
        model,
        ai,
        onLog,
        renderError ? (q.diagram?.diagramType === 'tikz' ? q.diagram.code : undefined) : (q.diagram?.diagramType === 'tikz' ? q.diagram.code : undefined),
        renderError,
      );
      if (tikzCode) {
        return {
          id: q.id,
          diagram: { diagramType: "tikz" as const, code: tikzCode },
        };
      }
      return null;
    }),
  );
  return results.filter((v): v is { id: string; diagram: TikzSpec } =>
    Boolean(v),
  );
}

// ── Three-phase question generation ────────────────────────────────────────────
// Phase 1 (Planning): Decide question topics and types (lightweight).
// Phase 2 (Writing): Write the questions freely.
// Phase 3 (Visualization): Generate TikZ code for questions that require a diagram.
// ───────────────────────────────────────────────────────────────────────────────

/** Internal descriptor produced in Phase 1 for each question slot. */
interface QuestionSlot {
  index: number;
  /** Short description of what the question will test, chosen by Phase 1 */
  topic: string;
  questionType: "mcq" | "short_answer" | "structured";
  /** Whether this question needs a diagram */
  hasDiagram: boolean;
}

export async function generateTest(
  config: GenerationConfig & { references?: Reference[]; apiKey?: string; diagramPool?: DiagramPoolEntry[] },
  onRetry?: (attempt: number) => void,
  onUsage?: UsageCallback,
  onLog?: (msg: string) => void,
): Promise<QuestionItem[]> {
  const ai = getAI(config.apiKey);
  const model = config.model || "gemini-2.5-flash";
  const subjectRules = SUBJECT_SPECIFIC_RULES[config.subject] ?? "";

  // Normalise question type from UI display string to clean internal value
  const rawType = config.type.toLowerCase();
  const cleanType: "mcq" | "short_answer" | "structured" | "mixed" =
    rawType.includes("mcq") || rawType.includes("multiple")
      ? "mcq"
      : rawType.includes("short")
        ? "short_answer"
        : rawType.includes("structured")
          ? "structured"
          : "mixed";

  // ── Collect all past paper items from references ─────────────────────────
  const allPastPaperItems: PastPaperItem[] = (config.references ?? [])
    .filter((r) => r.resourceType === "past_paper" && r.pastPaperItems?.length)
    .flatMap((r) => r.pastPaperItems!);

  /**
   * Score a past paper item against a slot topic.
   * Returns 0 if no match, higher = better match.
   */
  function scoreItemForTopic(item: PastPaperItem, slotTopic: string): number {
    const norm = slotTopic.toLowerCase().trim();
    const keywords = norm.split(/[\s,/]+/).filter((k) => k.length > 2);
    const topicLower = (item.topic ?? "").toLowerCase();
    const tagsLower = (item.tags ?? []).map((t) => t.toLowerCase());
    const questionLower = item.questionText.toLowerCase();
    let score = 0;
    if (topicLower === norm) score += 8;
    else if (topicLower.includes(norm)) score += 4;
    else if (keywords.some((k) => topicLower.includes(k))) score += 2;
    if (tagsLower.some((t) => t === norm)) score += 4;
    score += keywords.filter((k) => tagsLower.some((t) => t.includes(k))).length;
    score += keywords.filter((k) => questionLower.includes(k)).length * 0.5;
    return score;
  }

  /** Score a diagram pool entry against a slot topic.
   *
   * Scoring tiers:
   *  8  — exact topic match
   *  4  — partial topic match (substring either way)
   *  2  — keyword overlap in topics
   *  1  — keyword overlap in tags
   *  0.5 — keyword overlap in description
   *  0.1 — same subject, no other match (fallback so subject-matched entries
   *         are always preferred over a random cross-subject entry)
   *
   * Callers treat score === 0 as "no match at all". A subject-only match
   * returns 0.1 so that diagrams with empty topics/tags are still eligible
   * when no better match exists — preventing the "no matching pool entry"
   * message when there are hundreds of same-subject diagrams available.
   */
  function scoreDiagramEntryForTopic(entry: DiagramPoolEntry, slotTopic: string): number {
    const norm = slotTopic.toLowerCase().trim();
    const keywords = norm.split(/[\s,/]+/).filter((k) => k.length > 2);
    let score = 0;
    entry.topics.forEach((t) => {
      const tl = t.toLowerCase();
      if (tl === norm) score += 8;
      else if (tl.includes(norm) || norm.includes(tl)) score += 4;
      else if (keywords.some((k) => tl.includes(k))) score += 2;
    });
    entry.tags.forEach((tag) => {
      if (keywords.some((k) => tag.toLowerCase().includes(k))) score += 1;
    });
    if (entry.description) {
      const dl = entry.description.toLowerCase();
      score += keywords.filter((k) => dl.includes(k)).length * 0.5;
    }
    // Subject-level fallback: if the entry belongs to the same subject and
    // has no topic/tag match, give it a small base score so it can still be
    // selected when nothing better exists.
    if (score === 0 && entry.subject?.toLowerCase() === config.subject.toLowerCase()) {
      score = 0.1;
    }
    return score;
  }

  /**
   * Build a compact template block for one slot.
   * Picks the best-matching past paper item (score > 0).
   */
  function buildSlotTemplate(slotTopic: string, hasDiagram: boolean): string {
    if (allPastPaperItems.length === 0) return "";
    const scored = allPastPaperItems
      .map((item) => ({ item, score: scoreItemForTopic(item, slotTopic) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);
    // Prefer diagram items for diagram slots, non-diagram for others
    const preferred = hasDiagram
      ? scored.find(({ item }) => !!item.tikzCode) ?? scored[0]
      : scored.find(({ item }) => !item.tikzCode) ?? scored[0];
    if (!preferred) return "";
    const { item } = preferred;
    const lines: string[] = [
      `TEMPLATE (use this past paper question as the structural model):`,
      `Question: ${item.questionText}`,
      `Mark Scheme: ${item.markScheme}`,
    ];
    if (item.tikzCode) {
      lines.push(`Reference Diagram (TikZ — reuse structure, change values only):\n\`\`\`tikz\n${item.tikzCode}\n\`\`\``);
    }
    lines.push(
      `INSTRUCTION: Study WHY this past paper question is at its difficulty level — identify the cognitive demand (multi-step reasoning, unfamiliar context, data interpretation, synthesis across concepts). Replicate that same cognitive demand in a NEW question: same number of sub-parts, same command word, same mark total (${item.marks} marks), same difficulty pattern. Change ONLY the specific topic/numbers/context. Do NOT copy verbatim. Do NOT simplify the reasoning chain.`,
    );
    return lines.join("\n");
  }

  // ── Diagram pool config (computed once, used in Phase 1 prompt and Phase 2) ──
  const poolEntries = config.diagramPool ?? [];
  const useDiagramPool = config.useDiagramPool && poolEntries.length > 0;

  // ── Phase 1: Plan question slots (lightweight — no diagram data yet) ──────

  onLog?.("Phase 1: planning question slots…");

  const phase1Prompt = `You are a Cambridge IGCSE ${config.subject} Chief Examiner planning an assessment.

CONFIGURATION:
- Topic: ${config.topic}
- ${DIFFICULTY_GUIDANCE[config.difficulty] ?? `Difficulty: ${config.difficulty}`}
- Number of Questions: ${config.count}
- Question Type: ${cleanType === "mixed" ? "Mixed (any of: mcq, short_answer, structured)" : cleanType}
- Calculator: ${config.calculator ? "Allowed" : "Not Allowed"}
${config.syllabusContext ? `- Syllabus Context/Focus: ${config.syllabusContext}` : ""}

TASK: For each of the ${config.count} question slots, output ONLY:
- index: 0-based slot number
- topic: specific sub-topic to assess (must be DIFFERENT for every slot)
- questionType: one of "mcq", "short_answer", "structured" — match the configured type
- hasDiagram: true only if a visual diagram is VITAL for this sub-topic
${useDiagramPool ? `
DIAGRAM MODE: Pre-uploaded real images from past IGCSE papers will be used for diagram slots. Set hasDiagram: true ONLY for slots where an existing scientific diagram (cell structure, apparatus, circuit, organism, etc.) would genuinely enhance the question. Do NOT set hasDiagram: true for slots requiring geometry/graphs that must be drawn from scratch — those work better without a diagram in pool mode.` : `
DIAGRAM MODE: TikZ code will be generated for diagram slots. Set hasDiagram: true for slots where a geometric figure, graph, or scientific diagram is essential. TikZ will be generated automatically.`}

DO NOT generate any DSL, coordinates, or geometry here.
Geometry is generated separately in a later step.

SUB-TOPIC DIVERSITY (strictly enforce):
- Each slot MUST test a DIFFERENT sub-topic or skill within ${config.topic}.
- Spread across the widest possible range.
Return EXACTLY ${config.count} slots.`;

  const phase1Schema = {
    type: Type.OBJECT,
    properties: {
      slots: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            index: { type: Type.NUMBER },
            topic: { type: Type.STRING },
            questionType: { type: Type.STRING },
            hasDiagram: { type: Type.BOOLEAN },
          },
          required: ["index", "topic", "questionType", "hasDiagram"],
        },
      },
    },
    required: ["slots"],
  };

  // Phase 1 uses syllabus only (past papers add tokens without helping slot planning).
  // Phase 2+ uses all references (style replication from past papers matters for writing).
  const syllabusRefParts: any[] =
    config.references && config.references.length > 0
      ? buildReferenceParts(config.references, config.difficulty, true)
      : [];

  const allRefParts: any[] =
    config.references && config.references.length > 0
      ? buildReferenceParts(config.references, config.difficulty, false)
      : [];

  const rawSlots = await withRetry(
    async () => {
      const response = await ai.models.generateContent({
        model,
        contents: { parts: [...syllabusRefParts, { text: phase1Prompt }] },
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 65536,
          temperature: 0.4,
          responseSchema: phase1Schema,
        },
      });
      const usage = getGeminiUsage(response);
      if (usage) onUsage?.(model, usage.inputTokens, usage.outputTokens);
      const finishReason = (response as any)?.candidates?.[0]?.finishReason;
      const thoughtTokens =
        (response as any)?.usageMetadata?.thoughtsTokenCount ?? 0;
      onLog?.(
        `[Phase 1] length=${response.text?.length ?? 0} finishReason=${finishReason} thoughtTokens=${thoughtTokens}`,
      );
      if (finishReason === "MAX_TOKENS") {
        throw {
          type: "invalid_response",
          retryable: true,
          message: `Phase 1 hit token limit (thinking used ${thoughtTokens} tokens). Retrying…`,
        };
      }
      const parsed = safeJsonParse(response.text || "{}");
      if (!parsed.slots || parsed.slots.length < config.count) {
        throw {
          type: "invalid_response",
          retryable: true,
          message: `Phase 1 returned ${parsed.slots?.length ?? 0} slots, expected ${config.count}. Retrying…`,
        };
      }
      return parsed.slots;
    },
    3,
    onRetry,
  );

  // ── Slot normalisation ────────────────────────────────────────────────────────

  const validTypes = ["mcq", "short_answer", "structured"];
  const slots: QuestionSlot[] = [];

  for (let i = 0; i < Math.min(rawSlots.length, config.count); i++) {
    const s = rawSlots[i];
    slots.push({
      index: i,
      topic: s.topic ?? config.topic,
      questionType: (validTypes.includes(s.questionType) ? s.questionType : cleanType === "mixed" ? "short_answer" : cleanType) as QuestionSlot["questionType"],
      hasDiagram: Boolean(s.hasDiagram),
    });
    if (i < config.count - 1) await new Promise((r) => setTimeout(r, 300));
  }

  // ── Phase 2 shared config ────────────────────────────────────────────────────

  const phase2SystemInstruction = `You are a Senior Cambridge IGCSE Chief Examiner for ${config.subject} with 20+ years of experience.

CAMBRIDGE COMMAND WORDS:
${Object.entries(CAMBRIDGE_COMMAND_WORDS)
  .map(([w, d]) => `- **${w}**: ${d}`)
  .join("\n")}

ASSESSMENT OBJECTIVES:
- AO1: recall, state, name, define — 1–2 mark questions
- AO2: apply, calculate, interpret, deduce — 2–4 mark questions
- AO3: plan experiments, identify variables, evaluate — 2–4 mark questions
`;

  const questionSchema = {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING },
      answer: { type: Type.STRING },
      markScheme: { type: Type.STRING },
      marks: { type: Type.NUMBER },
      commandWord: { type: Type.STRING },
      type: { type: Type.STRING },
      hasDiagram: { type: Type.BOOLEAN },
      syllabusObjective: { type: Type.STRING, nullable: true },
      assessmentObjective: { type: Type.STRING, nullable: true },
      difficultyStars: { type: Type.NUMBER, nullable: true },
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["text", "answer", "markScheme", "marks", "commandWord", "type", "hasDiagram", "options"],
  };

  const tikzQuestionSchema = {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING },
      tikzCode: { type: Type.STRING },
      answer: { type: Type.STRING },
      markScheme: { type: Type.STRING },
      marks: { type: Type.NUMBER },
      commandWord: { type: Type.STRING },
      type: { type: Type.STRING },
      hasDiagram: { type: Type.BOOLEAN },
      syllabusObjective: { type: Type.STRING, nullable: true },
      assessmentObjective: { type: Type.STRING, nullable: true },
      difficultyStars: { type: Type.NUMBER, nullable: true },
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["text", "tikzCode", "answer", "markScheme", "marks", "commandWord", "type", "hasDiagram", "options"],
  };

  /**
   * Writes ONE diagram question AND generates the TikZ code for it in a single Gemini call.
   */
  async function writeQuestionsWithTikz(tikzSlots: QuestionSlot[]): Promise<any[]> {
    if (tikzSlots.length === 0) return [];

    const slotDescriptions = tikzSlots
      .map((s) => {
        const template = buildSlotTemplate(s.topic, true);
        const catHint = categoryRules(s.topic);
        return `Q${s.index + 1}: topic="${s.topic}", type="${s.questionType}"${catHint ? `\n${catHint}` : ""}${template ? `\n${template}` : ""}`;
      })
      .join("\n\n");

    const prompt = `You are a Cambridge IGCSE ${config.subject} examiner AND a LaTeX/TikZ expert.

Write EXACTLY ${tikzSlots.length} exam questions, each with a geometric diagram.

CONFIGURATION:
- ${DIFFICULTY_GUIDANCE[config.difficulty] ?? `Difficulty: ${config.difficulty}`}
- Calculator: ${config.calculator ? "Allowed" : "Not Allowed"}
${config.syllabusContext ? `- Syllabus focus: ${config.syllabusContext}` : ""}

QUESTION SLOTS (each slot may include a TEMPLATE from a real past paper):
${slotDescriptions}

PAST PAPER USAGE — CRITICAL:
If past papers are provided above, extract their COGNITIVE DEMAND pattern: how many reasoning steps are required, how unfamiliar context is introduced, how diagram values feed into multi-step solutions. Replicate this level of demand — do NOT produce simpler questions because they are easier to write.

QUESTION REQUIREMENTS (each question):
- If a TEMPLATE is provided for the slot, replicate its cognitive demand exactly (same sub-parts, command word, mark total, reasoning complexity). Change only numbers, measurements, context. Do NOT simplify.
- If no TEMPLATE, create an original Cambridge-style question at the configured difficulty level.
- Must require the diagram to solve
- LaTeX: all math in $...$
- MCQ: 4 options array, answer = "A"/"B"/"C"/"D"

TIKZ REQUIREMENTS (each diagram):
- Write ONLY the \\begin{tikzpicture}...\\end{tikzpicture} block — NO \\documentclass, NO \\usepackage, NO \\begin{document}
- Cambridge exam style: thick lines, filled dots at vertices, clear labels
- Use \\coordinate for named points, calc interpolation $(A)!0.5!(B)$ is allowed
- Angle arcs: use the 'angles' library with \\pic syntax. Use "angle radius" and "angle eccentricity" (SPACE, NOT underscore).
- \\pic SYNTAX — CRITICAL: \\pic["label", draw, angle radius=0.8cm] {angle = A--B--C} where A, B, C are ALL \\coordinate names. NEVER use calc expressions like $(R)+(1,0)$ inside \\pic args — this crashes pdflatex. Define a helper coord instead: \\coordinate (Rright) at ($(R)+(1,0)$); then \\pic{angle = Rright--R--S}.
- REFLEX ANGLES (>180°): do NOT use \\pic. Draw arc manually: \\draw ($(B)+(0.9,0)$) arc[start angle=0, end angle=-295, radius=0.9cm] node[pos=0.5, right] {$295^\\circ$};
- NEVER use angle options={reflex} — this key does not exist and will crash pdflatex.
- Right angles: small square marker (\\draw (0.2,0) -- (0.2,0.2) -- (0,0.2);)
- NO % comment lines — omit all comments from the TikZ code
- Available libraries: calc, arrows.meta, angles, quotes, patterns, positioning
- Diagram must match question exactly (same letters, values, geometry)
- If a Reference Diagram (TikZ) is provided in the slot TEMPLATE, reuse its structure — change only numeric values and labels.
- CRITICAL: every { must have a matching } — count your braces before outputting
- CRITICAL: every \\begin{...} must have a matching \\end{...}
- CRITICAL: every command must end with a semicolon

GEOMETRIC ACCURACY (verify before outputting):
- Angle arcs MUST visually match the stated value: 70° arc sweeps exactly 70° (acute, not obtuse). Acute < 90°, obtuse 90°–180°.
- Arc sweep must use the SMALLER angle between two rays unless reflex is explicitly stated.
- Parallel lines: alternate angles are equal — draw arcs on opposite sides of transversal. Co-interior angles sum to 180°.
- Right angles: use square marker, never an arc.
- Read your own question answer and verify each arc in your TikZ matches those exact values.

MARK SCHEME: Cambridge notation (B1, M1, A1).`;

    return withRetry(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [...allRefParts, { text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 32768,
          temperature: 0.7,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: { type: Type.ARRAY, items: tikzQuestionSchema },
            },
            required: ["questions"],
          },
          systemInstruction: phase2SystemInstruction,
        },
      });
      const usage = getGeminiUsage(response);
      if (usage) onUsage?.(model, usage.inputTokens, usage.outputTokens);
      const finishReason = (response as any)?.candidates?.[0]?.finishReason;
      const thoughtTokens = (response as any)?.usageMetadata?.thoughtsTokenCount ?? 0;
      onLog?.(`[Phase 2 TikZ batch] length=${response.text?.length ?? 0} finishReason=${finishReason} thoughtTokens=${thoughtTokens}`);
      if (finishReason === "MAX_TOKENS") {
        throw { type: "invalid_response", retryable: true, message: `TikZ batch hit token limit. Retrying…` };
      }
      const parsed = safeJsonParse(response.text || "{}");
      if (!parsed.questions || parsed.questions.length < tikzSlots.length) {
        throw { type: "invalid_response", retryable: true, message: `TikZ batch returned ${parsed.questions?.length ?? 0} questions, expected ${tikzSlots.length}.` };
      }
      parsed.questions.forEach((q: any, i: number) => {
        onLog?.(`[Phase 2] Q${tikzSlots[i].index + 1}: TikZ generated (${q.tikzCode?.length ?? 0} chars)`);
      });
      return parsed.questions;
    }, 3, onRetry);
  }

  /**
   * Writes diagram questions that reference real past-paper images from the diagram pool.
   * The AI sees the image URL + description and writes a question around it.
   */
  /** Fetch an image URL and return base64 + mimeType for Gemini inlineData. */
  async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const blob = await res.blob()
      const mimeType = blob.type || 'image/png'
      return new Promise(resolve => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const dataUrl = reader.result as string
          const base64 = dataUrl.split(',')[1]
          resolve(base64 ? { data: base64, mimeType } : null)
        }
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
    } catch {
      return null
    }
  }

  /**
   * Writes diagram questions where the AI actually SEES each diagram image
   * via Gemini vision (inlineData), so questions are grounded in the real image.
   * Falls back to text-only description if image fetch fails.
   */
  async function writeQuestionsWithRasterDiagram(
    rasterSlots: QuestionSlot[],
    pickedEntries: DiagramPoolEntry[],
  ): Promise<any[]> {
    if (rasterSlots.length === 0) return [];

    // Fetch all images in parallel (best-effort — failure falls back to description)
    const imageData = await Promise.all(
      pickedEntries.map(entry => fetchImageAsBase64(entry.imageURL))
    )

    // Build one call per slot so each gets its own image in the vision context.
    // We do them in parallel to keep latency low.
    const perSlotResults = await Promise.all(
      rasterSlots.map(async (slot, i) => {
        const entry = pickedEntries[i]
        const imgB64 = imageData[i]
        const template = buildSlotTemplate(slot.topic, true)

        const slotText = [
          `Generate exactly 1 Cambridge IGCSE ${config.subject} question for the diagram shown above.`,
          ``,
          `SLOT CONFIGURATION:`,
          `- topic: "${slot.topic}"`,
          `- questionType: "${slot.questionType}"`,
          `- ${DIFFICULTY_GUIDANCE[config.difficulty] ?? `Difficulty: ${config.difficulty}`}`,
          `- Calculator: ${config.calculator ? "Allowed" : "Not Allowed"}`,
          config.syllabusContext ? `- Syllabus focus: ${config.syllabusContext}` : "",
          ``,
          `RULES:`,
          `1. Study the diagram carefully. Write a question that DIRECTLY requires the student to read, interpret, or analyse this specific diagram.`,
          `2. Open with "The diagram shows…" or "Using the diagram…" or "Refer to the diagram…".`,
          `3. MCQ: 4 options (no letter prefix); answer = "A"/"B"/"C"/"D".`,
          `4. LaTeX math in $...$. syllabusObjective: "REF – statement" format.`,
          `5. assessmentObjective: "AO1"|"AO2"|"AO3". difficultyStars: 1|2|3.`,
          `6. hasDiagram: true.`,
          `7. Do NOT recreate the diagram in TikZ.`,
          template ? `\n${template}` : "",
        ].filter(s => s !== undefined).join("\n")

        const parts: any[] = []

        if (imgB64) {
          // Vision: AI sees the actual diagram
          parts.push({ inlineData: { mimeType: imgB64.mimeType, data: imgB64.data } })
          onLog?.(`[Phase 2] Q${slot.index + 1}: sending diagram image to Gemini vision (${entry.imageName})`)
        } else {
          // Fallback: describe from metadata
          const desc = entry.description || entry.topics.join(", ") || entry.imageName
          parts.push({ text: `[DIAGRAM: ${desc}]` })
          onLog?.(`[Phase 2] Q${slot.index + 1}: image fetch failed, using description fallback`)
        }

        parts.push(...allRefParts, { text: slotText })

        return withRetry(async () => {
          const response = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts }],
            config: {
              responseMimeType: "application/json",
              maxOutputTokens: 8192,
              temperature: 0.75,
              responseSchema: {
                type: Type.OBJECT,
                properties: { questions: { type: Type.ARRAY, items: questionSchema } },
                required: ["questions"],
              },
              systemInstruction: phase2SystemInstruction,
            },
          })
          const usage = getGeminiUsage(response)
          if (usage) onUsage?.(model, usage.inputTokens, usage.outputTokens)
          const finishReason = (response as any)?.candidates?.[0]?.finishReason
          onLog?.(`[Phase 2 vision Q${slot.index + 1}] length=${response.text?.length ?? 0} finishReason=${finishReason}`)
          if (finishReason === "MAX_TOKENS") {
            throw { type: "invalid_response", retryable: true, message: `Vision slot Q${slot.index + 1} hit token limit. Retrying…` }
          }
          const parsed = safeJsonParse(response.text || "{}");
          if (!parsed.questions?.length) {
            throw { type: "invalid_response", retryable: true, message: `Vision slot Q${slot.index + 1} returned no question.` }
          }
          return parsed.questions[0]
        }, 3, onRetry)
      })
    )

    return perSlotResults
  }

  /**
   * Writes all non-diagram questions in a single batch call.
   */
  async function writeQuestionsWithoutDSL(batchSlots: QuestionSlot[]): Promise<any[]> {
    if (batchSlots.length === 0) return [];

    const batchDescriptions = batchSlots
      .map((s) => {
        const template = buildSlotTemplate(s.topic, false);
        return `Q${s.index + 1}: topic="${s.topic}", type="${s.questionType}"${template ? `\n${template}` : ""}`;
      })
      .join("\n\n");

    const prompt = `Generate a Cambridge IGCSE ${config.subject} assessment.

CONFIGURATION:
- Topic: ${config.topic}
- ${DIFFICULTY_GUIDANCE[config.difficulty] ?? `Difficulty: ${config.difficulty}`}
- Calculator: ${config.calculator ? "Allowed" : "Not Allowed"}
${config.syllabusContext ? `- Syllabus Context/Focus: ${config.syllabusContext}` : ""}

${subjectRules ? `${subjectRules}\n` : ""}${MARK_SCHEME_FORMAT}

QUESTION SLOTS (write EXACTLY ${batchSlots.length} questions in this order):
${batchDescriptions}

PAST PAPER USAGE — CRITICAL:
If past papers are provided above, study them to extract:
- The COGNITIVE DEMAND pattern (how many reasoning steps, what kind of synthesis)
- The QUESTION FRAMING style (how unfamiliar context is introduced, how data is presented)
- The MARK SCHEME granularity (how many distinct marking points per mark)
Replicate this level of cognitive demand in your questions. Do NOT produce simpler questions just because they are easier to write.

RULES:
1. If a slot has a TEMPLATE, mirror its cognitive demand exactly (same sub-parts, command word, mark total, reasoning complexity). Change only numbers, measurements, and context. Do NOT copy verbatim. Do NOT simplify.
2. If no TEMPLATE, write an original Cambridge-style question matching the difficulty standard above.
3. MCQ: 4 options (no letter prefix); answer = "A"/"B"/"C"/"D".
4. Short answer: 1–3 marks, no sub-parts.
5. Structured: stem + (a),(b),(c) sub-parts with [n] marks each.
6. LaTeX: all math in $...$. syllabusObjective: "REF – statement" format.
7. assessmentObjective: "AO1" | "AO2" | "AO3". difficultyStars: 1|2|3.
8. hasDiagram: false for all these questions.
9. answer field: MCQ = letter; others = method description only (no numbers).`;

    return withRetry(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: { parts: [...allRefParts, { text: prompt }] },
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 32768,
          temperature: 0.75,
          responseSchema: {
            type: Type.OBJECT,
            properties: { questions: { type: Type.ARRAY, items: questionSchema } },
            required: ["questions"],
          },
          systemInstruction: phase2SystemInstruction,
        },
      });
      const usage = getGeminiUsage(response);
      if (usage) onUsage?.(model, usage.inputTokens, usage.outputTokens);
      const finishReason = (response as any)?.candidates?.[0]?.finishReason;
      const thoughtTokens = (response as any)?.usageMetadata?.thoughtsTokenCount ?? 0;
      onLog?.(`[Phase 2 batch] length=${response.text?.length ?? 0} finishReason=${finishReason} thoughtTokens=${thoughtTokens}`);
      if (finishReason === "MAX_TOKENS") {
        throw { type: "invalid_response", retryable: true, message: `Phase 2 batch hit token limit. Retrying…` };
      }
      const parsed = safeJsonParse(response.text || "{}");
      if (!parsed.questions || parsed.questions.length < batchSlots.length) {
        throw { type: "invalid_response", retryable: true, message: `Phase 2 batch returned ${parsed.questions?.length ?? 0} questions, expected ${batchSlots.length}.` };
      }
      return parsed.questions;
    }, 3, onRetry);
  }

  // ── Phase 2: Write questions (TikZ for diagram slots, batch for non-diagram) ──

  onLog?.("Phase 2: writing questions…");

  const dslSlots    = slots.filter((s) => s.hasDiagram);
  const nonDslSlots = slots.filter((s) => !s.hasDiagram);

  const rawQuestionsMap: Record<number, any> = {};

  if (dslSlots.length > 0) {
    if (useDiagramPool) {
      // Split diagram slots: those with a matching pool entry vs those with no match (score === 0)
      // Shuffle pool entries once so equal-score ties resolve randomly each run.
      const shuffledPool = [...poolEntries].sort(() => Math.random() - 0.5);
      const usedEntryIds = new Set<string>();
      const picked = dslSlots.map((slot) => {
        const scored = shuffledPool
          .map((e) => ({ e, score: scoreDiagramEntryForTopic(e, slot.topic) }))
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score);
        // Prefer an entry not already assigned to another slot in this batch
        const best = scored.find(({ e }) => !usedEntryIds.has(e.id)) ?? scored[0] ?? null;
        if (best) usedEntryIds.add(best.e.id);
        return best?.e ?? null;
      });

      const matchedSlots = dslSlots.filter((_, i) => picked[i] !== null);
      const matchedEntries = picked.filter((e): e is DiagramPoolEntry => e !== null);
      const unmatchedSlots = dslSlots.filter((_, i) => picked[i] === null);

      if (unmatchedSlots.length > 0) {
        onLog?.(`[Phase 2] ${unmatchedSlots.length} diagram slot(s) have no matching pool entry — generating without diagram`);
      }

      if (matchedSlots.length > 0) {
        onLog?.(`[Phase 2] writing ${matchedSlots.length} diagram question(s) using diagram pool (${poolEntries.length} images)…`);
        const rasterResults = await writeQuestionsWithRasterDiagram(matchedSlots, matchedEntries);
        matchedSlots.forEach((slot, i) => {
          rawQuestionsMap[slot.index] = { ...rasterResults[i], _poolEntry: matchedEntries[i] };
        });
      }

      if (unmatchedSlots.length > 0) {
        const unmatchedResults = await writeQuestionsWithoutDSL(unmatchedSlots);
        unmatchedSlots.forEach((slot, i) => { rawQuestionsMap[slot.index] = unmatchedResults[i]; });
      }
    } else {
      onLog?.(`[Phase 2] writing ${dslSlots.length} diagram question(s) + TikZ…`);
      const tikzResults = await writeQuestionsWithTikz(dslSlots);
      dslSlots.forEach((slot, i) => { rawQuestionsMap[slot.index] = tikzResults[i]; });
    }
  }

  const nonDslResults = await writeQuestionsWithoutDSL(nonDslSlots);
  nonDslSlots.forEach((slot, batchIdx) => { rawQuestionsMap[slot.index] = nonDslResults[batchIdx]; });

  const rawQuestions = { questions: slots.map((s) => rawQuestionsMap[s.index]).filter(Boolean) };

  // Stitch: sanitize questions and attach diagram (TikZ or raster pool image)
  let questions: QuestionItem[] = (rawQuestions.questions ?? []).map((q: any, i: number) => {
    const sanitized = sanitizeQuestion(q);
    const slot = slots[i];
    const hasTikz = (slot?.hasDiagram || sanitized.hasDiagram) && !!q.tikzCode;
    const hasRaster = (slot?.hasDiagram || sanitized.hasDiagram) && !!q._poolEntry;
    const hasDiagram = hasTikz || hasRaster;

    const diagram: TikzSpec | RasterSpec | undefined = hasTikz
      ? { diagramType: "tikz" as const, code: q.tikzCode }
      : hasRaster
        ? { diagramType: "raster" as const, url: (q._poolEntry as DiagramPoolEntry).imageURL, maxWidth: 480 }
        : undefined;

    return {
      ...sanitized,
      hasDiagram,
      ...(diagram ? { diagram } : {}),
      id: crypto.randomUUID(),
      code: sharedGenerateQuestionCode(config.subject, {
        text: sanitized.text,
        syllabusObjective: sanitized.syllabusObjective,
      }),
    } as QuestionItem;
  });

  // Phase 4: Mandatory Critique & Refine (Diagram Dependency & Quality)
  if (questions.length > 0) {
    questions = await critiqueAndRefine(
      questions,
      config.subject,
      model,
      ai,
      onRetry,
      onUsage,
      config.difficulty,
    );
  }

  // Phase 4.5: Auto-Regeneration Loop (Hard Validation — Challenging only)
  // For Easy/Medium/Balanced the critiqueAndRefine pass (Phase 4) is sufficient.
  if (questions.length > 0 && config.difficulty === "Challenging") {
    for (let i = 0; i < questions.length; i++) {
      let q = questions[i];
      let attempts = 0;

      while (attempts < 2) {
        const qualityCheck = enforceQuestionQuality(q);
        const tooEasy = isTooEasy(q);
        const isAStar = isAStarLevel(q, config.difficulty);
        const hasCognitive = hasCognitiveLoad(q);

        if (qualityCheck.isValid && !tooEasy && isAStar && hasCognitive) break;

        const issues = [...qualityCheck.reasons];
        if (tooEasy)
          issues.push("Question is too easy/recall-based for A* level.");
        if (!isAStar)
          issues.push(
            "Not A* level difficulty (requires multi-step deduction/proof).",
          );
        if (!hasCognitive) issues.push("Cognitive load too low.");

        onLog?.(
          `Regenerating Q${i + 1} (Attempt ${attempts + 1}): ${issues.join(", ")}`,
        );

        const newQ = await regenerateSingleQuestion(
          q,
          issues,
          config,
          ai,
          model,
        );
        if (newQ) {
          questions[i] = newQ;
          q = newQ;
        }
        attempts++;
      }
    }
  }

  return questions;
}

/** Returns category-specific geometry rules based on question content */
function categoryRules(questionText: string): string {
  const t = questionText.toLowerCase();

  if (/parallel|transversal|alternate|co-interior|corresponding/.test(t)) {
    return `
CATEGORY: Parallel Lines & Transversal
- Draw two horizontal parallel lines with arrows at both ends (use \\draw[<->]).
- Draw one transversal crossing both lines at a non-right angle (e.g. 55°–75° tilt).
- Place the stated angle arc at the CORRECT vertex. Never place it at a different intersection.
- Alternate interior angles: on OPPOSITE sides of the transversal, between the parallels.
- Co-interior angles: on the SAME side of the transversal, between the parallels.
- Corresponding angles: on the SAME side, one above/one below — mark them with matching arcs (both \\pic or both drawn the same way).
- Label each intersection with a letter. Label the transversal and both parallel lines.
- Example for 130° at top intersection: \\pic["$130^\\circ$", draw, angle radius=0.8cm] {angle = B--A--C};`;
  }

  if (/isosceles|equilateral|triangle|angle [A-Z]{2,3}|\\triangle/.test(t)) {
    return `
CATEGORY: Triangle / Polygon Angles
- Draw the triangle with vertices at explicit numeric coordinates — compute them from the stated angles using trigonometry yourself.
- For isosceles triangles: the two equal sides must be visually equal. Place the apex at the top.
- Arc for each angle must sweep the INTERIOR angle at that vertex: start from one side, sweep to the other, sweeping INWARD not outward.
- A 50° angle at a vertex: arc sweeps 50°. A 130° angle at a vertex: arc sweeps 130° (obtuse).
- If the triangle sits between two parallel lines, draw those lines as horizontal arrows.
- Label every vertex. Label every stated angle with its degree value.`;
  }

  if (/circle|tangent|chord|arc|sector|segment|radius|diameter|circumference|subtend/.test(t)) {
    return `
CATEGORY: Circle Theorems
- Draw the circle with \\draw (center) circle (radius); — radius should be 1.8–2.2cm for readability.
- Mark the centre O with a filled dot: \\fill (O) circle (2pt);
- Tangent at point B: draw a straight line through B perpendicular to OB. The radius OB meets the tangent at exactly 90° — mark this with a square right-angle marker.
- For "tangent from external point": draw the external point, two tangent lines touching the circle, and any radii to the tangent points.
- Angle at centre = 2 × angle at circumference (on same arc) — draw both clearly.
- Do NOT draw a small circle at a label point unless the question describes a small separate circle there.

ANGLE ARC RULES — follow exactly:
- ALWAYS use \\pic to draw angle arcs. NEVER use \\draw arc[start angle=..., end angle=...] to mark an angle — this almost always places the arc at the wrong position or sweeps the wrong direction.
- \\pic syntax: \\pic["$X^\\circ$", draw, angle radius=0.5cm] {angle = P--V--Q};
  where V is the VERTEX of the angle, P and Q are points on the two rays forming the angle.
- The arc sweeps from ray VP to ray VQ going counterclockwise. \\pic automatically sweeps the SMALLER (interior) angle.
- For angle OAB (vertex A, rays toward O and toward B): \\pic["$28^\\circ$", draw, angle radius=0.5cm] {angle = O--A--B};
- For angle OBC at tangent point B (the 90° right angle): use a square marker, NOT \\pic.
- If the arc must sweep from a direction without a named point (e.g. from the tangent line extension), define a helper \\coordinate first:
  \\coordinate (Cext) at ($(B)!-1!(A)$); — this is the extension of AB beyond B
  then: \\pic["$X^\\circ$", draw, angle radius=0.5cm] {angle = Cext--B--O};
- Verify: the three points P--V--Q in \\pic must be \\coordinate names, NEVER inline expressions.`;
  }

  if (/net|cube|cuboid|fold|face|surface area/.test(t)) {
    return `
CATEGORY: 3D Net / Solid
- Draw each face as an explicit rectangle/square at exact grid coordinates — do NOT use filled gray rectangles.
- For a cube net: 6 squares each of the same side length. Use one of the 11 valid net layouts.
- Cross-shaped net (valid): one vertical column of 4 squares, two squares on either side of the second square.
- T-shaped net (valid): similar arrangement.
- Draw all squares with \\draw[thick] as outlines only (no fill, or very light gray fill).
- Label each face A, B, C, D as required by the question.
- Grid unit: use 1cm per face unit. Ensure all squares share edges correctly.`;
  }

  if (/bearing|north|compass|scale drawing/.test(t)) {
    return `
CATEGORY: Bearings / Scale Drawing
- Draw a North arrow (\\draw[->]) pointing straight up from the reference point.
- Bearing angles are measured CLOCKWISE from North. A bearing of 070° → arc from North arrow, sweeping 70° clockwise.
- Label the bearing angle with its 3-digit value (e.g. 070°).
- Draw the path/direction line from the reference point at the correct bearing.`;
  }

  if (/vector|displacement|resultant/.test(t)) {
    return `
CATEGORY: Vectors
- Draw vectors as arrows: \\draw[->, thick] (start) -- (end);
- Label vectors with bold letters or overrightarrow notation in the question labels.
- For resultant: draw the triangle of vectors (head-to-tail arrangement).
- Parallelogram law: draw two vectors from same origin, complete the parallelogram, diagonal = resultant.`;
  }

  return "";
}

/** Generates complete LaTeX/TikZ code for a single question */
async function generateTikzCode(
  question: { text: string; answer: string; diagramType?: string; diagramData?: any },
  subject: string,
  model: string,
  ai: ReturnType<typeof getAI>,
  onLog?: (msg: string) => void,
  previousCode?: string,
  renderError?: string,
): Promise<string | null> {
  const errorBlock = renderError
    ? `
PREVIOUS VERSION FAILED TO COMPILE — this is the pdflatex error:
${renderError}

The code above produced this error. You MUST rewrite the diagram from scratch — do NOT reuse the broken code. Study the error to understand what went wrong, then write a completely fresh, correct TikZ block.
`
    : "";

  const improvementBlock = previousCode && !renderError
    ? `
PREVIOUS VERSION (proofread and fix this diagram):
${previousCode}

PROOFREAD FOR:
- Geometric accuracy: do the angle arcs match the values stated in the question? e.g. if the question says 70°, the arc must sweep exactly 70° (acute). If an arc looks obtuse but should be acute, fix the arc.
- Parallel line diagrams: are arcs on the correct side of the transversal for the angle type (alternate/co-interior/corresponding)?
- Right angles: should use a square marker, not an arc.
- Missing labels, incorrect coordinates, or proportions that don't match the question.
- CRITICAL: any \\draw arc[start angle=..., end angle=...] used to mark an angle MUST be replaced with \\pic["$X^\\circ$", draw, angle radius=0.5cm] {angle = P--V--Q} — raw arc commands almost always sweep the wrong direction. Define helper \\coordinate points if needed.
- Keep total line count inside tikzpicture ≤ 30.
`
    : "";

  const diagramSpecBlock =
    question.diagramType || question.diagramData
      ? `\nDIAGRAM SPECIFICATION:
- Type: ${question.diagramType ?? "unspecified"}
- Data (use these exact coordinates): ${question.diagramData ? JSON.stringify(question.diagramData) : "none"}
`
      : "";

  const catRules = categoryRules(question.text);

  const prompt = `Generate a concise, exam-quality LaTeX/TikZ diagram for this ${subject} question.
${errorBlock}${improvementBlock}${diagramSpecBlock}
QUESTION: ${question.text}
ANSWER: ${question.answer}
${catRules}

STRICT REQUIREMENTS — follow exactly:
1. Output ONLY the \\begin{tikzpicture}...\\end{tikzpicture} block — NO \\documentclass, NO \\usepackage, NO \\begin{document}.
2. Add \\usetikzlibrary{...} on the line BEFORE \\begin{tikzpicture} if needed.
3. Use \\coordinate for named points. calc interpolation $(A)!0.5!(B)$ is fully supported.
4. Label all key points and values. Mark right angles with a small square.
5. CRITICAL: every command MUST end with a semicolon.
6. CRITICAL: every { must have a matching } — unmatched braces cause a compile error.
7. CRITICAL: every \\begin{...} must have a matching \\end{...}.
8. You MUST output the complete block ending with \\end{tikzpicture} — never truncate.
9. If no diagram is needed, output nothing (empty string).

GEOMETRIC ACCURACY (verify before outputting):
- Angle arcs MUST visually match the stated angle value: a 70° arc must sweep exactly 70°, not 110° or 180°. Acute angles (< 90°) must look acute; obtuse angles (90°–180°) must look obtuse.
- For parallel line diagrams: alternate interior angles are EQUAL; co-interior angles sum to 180°. Draw arcs on the correct side of the transversal.
- For triangles: angles at each vertex must visually match the stated values. A right angle must use a square marker, not an arc.
- Arc sweep direction: use the SMALLER angle between the two rays unless the question explicitly asks for the reflex angle.
- Double-check: read the question answer, then verify your arc sweeps match those exact angle values geometrically.

KEEP IT SIMPLE:
- Use hardcoded numeric coordinates — do NOT use \\pgfmathsetmacro or \\pgfmathparse for coordinate calculations. Compute values yourself and write them as literals (e.g. "at (1.46, 3)" not "at (\\xS, 3)").
- Maximum 25 lines inside tikzpicture. NO % comment lines at all. No \\def or \\newcommand.
- Simple is more reliable: fewer commands = fewer compile errors.

NODE PLACEMENT — CRITICAL:
- NEVER use \\node[...] at (A) -- (B) {...}; — this is INVALID syntax and will crash pdflatex.
- To label the midpoint of a line segment, compute the midpoint coordinate yourself and place a node there:
  \\coordinate (MAB) at ($(A)!0.5!(B)$); \\node[above, sloped] at (MAB) {label};
- Alternatively, use a \\draw path with an inline node: \\draw (A) -- node[above, sloped] {label} (B);
  (inline node on a draw path is valid — standalone \\node at path is NOT).

\\pic ANGLE SYNTAX — CRITICAL:
- \\pic requires THREE named \\coordinate names: \\pic["label", draw, ...] {angle = A--B--C}
- NEVER use calc expressions inside \\pic args: \\pic{angle = $(R)+(1,0)$--R--S} is INVALID and will crash.
- NEVER use angle options={reflex} — this key does not exist and will crash pdflatex.
- To mark an angle relative to a horizontal direction, define a helper coord first:
  \\coordinate (Rright) at ($(R)+(1,0)$);
  \\pic["$70^\\circ$", draw, angle radius=0.8cm] {angle = Rright--R--S};
- For REFLEX angles (>180°): do NOT use \\pic. Instead draw an arc manually:
  \\draw[->] (B) ++(startAngle:radius) arc[start angle=startAngle, end angle=endAngle, radius=radius] node[midway, label] {};
  Example for 295° reflex at B from 0° sweeping 295° clockwise (i.e. -295°):
  \\draw ($(B)+(0.9,0)$) arc[start angle=0, end angle=-295, radius=0.9cm] node[pos=0.5, right] {$295^\\circ$};`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.2, maxOutputTokens: 16384 },
    });
    const text = response.text?.trim();
    // Try to extract fenced code block first to handle preamble text like "Here is the code:"
    const fencedMatch = text?.match(/```(?:latex|tex)?\s*([\s\S]*?)```/i);
    const clean = fencedMatch ? fencedMatch[1].trim() : text?.replace(/^```(latex|tex)?/i, "").replace(/```$/, "").trim();

    onLog?.(`[TikZ] generated ${clean?.length ?? 0} chars`);

    // If output is truncated (missing \end{tikzpicture}), retry without previousCode
    if (clean && !/\\end\{tikzpicture\}/.test(clean) && previousCode) {
      onLog?.(`[TikZ] output truncated — retrying fresh without previousCode`);
      return generateTikzCode(question, subject, model, ai, onLog);
    }

    return clean || null;
  } catch (err) {
    onLog?.(`[TikZ] generation error: ${err}`);
    return null;
  }
}

/** Regenerate a single failing question with strict feedback */
async function regenerateSingleQuestion(
  original: QuestionItem,
  issues: string[],
  config: GenerationConfig,
  ai: any,
  model: string,
): Promise<QuestionItem | null> {
  const difficultyRequirements =
    config.difficulty === "Challenging"
      ? "Multi-step reasoning, minimum 3 steps, unfamiliar context, 4–6 marks."
      : config.difficulty === "Medium"
        ? "2-step reasoning, apply concepts to a given scenario, 2–4 marks."
        : "Clear, direct, single-concept question appropriate for recall level, 1–2 marks.";

  const prompt = `
    REGENERATE this specific Cambridge IGCSE ${config.subject} question.
    TARGET DIFFICULTY: ${config.difficulty}

    PREVIOUS FAILED VERSION:
    "${original.text}"
    (Type: ${original.type}, Marks: ${original.marks})

    ISSUES DETECTED (MUST FIX):
    ${issues.map((s) => `- ${s}`).join("\n")}

    STRICT REQUIREMENTS:
    1. Match the target difficulty: ${difficultyRequirements}
    2. Use Cambridge command words appropriate for ${config.difficulty} difficulty.
    3. Ensure diagram is REQUIRED (if present).
    4. Do NOT output markdown. Output ONLY the JSON object for the question.

    Return JSON matching the schema:
    { "text": "...", "answer": "...", "markScheme": "...", "marks": 4, "commandWord": "...", "type": "...", "hasDiagram": ${original.hasDiagram}, "options": [...] }
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.8,
      },
    });
    const parsed = safeJsonParse(response.text || "{}");
    if (!parsed.text) return null;

    const sanitized = sanitizeQuestion(parsed);

    return {
      ...sanitized,
      answer: sanitized.answer,
      markScheme: sanitized.markScheme,
      id: original.id,
      code: original.code,
      // Preserve existing diagram — regeneration only rewrites text/markScheme
      diagram: original.diagram,
      hasDiagram: original.hasDiagram,
    };
  } catch (e) {
    console.warn("Regeneration failed:", e);
    return null;
  }
}

async function critiqueAndRefine(
  questions: QuestionItem[],
  subject: string,
  model: string,
  ai: ReturnType<typeof getAI>,
  onRetry?: (attempt: number) => void,
  onUsage?: UsageCallback,
  difficulty?: string,
): Promise<QuestionItem[]> {
  const questionsText = questions
    .map((q, i) => {
      const diagramNote = q.diagram
        ? `\n[This question has a diagram: ${q.diagram.diagramType}. Do NOT change the diagram — only rewrite the text/markScheme/commandWord if needed.]`
        : "";
      return `Q${i + 1} [${q.marks} marks] (${q.commandWord})\n${q.text}\n\nAnswer: ${q.answer}\n\nMark Scheme: ${q.markScheme}${diagramNote}`;
    })
    .join("\n\n---\n\n");

  const difficultyStandard =
    difficulty === "Easy"
      ? `REQUIRED STANDARD: Easy (Cambridge IGCSE Grade C–E level)
- Target: 80–90% of students should answer correctly
- Acceptable command words: State, Name, Define, List, Identify, Calculate (1-step)
- Single concept, direct recall, familiar contexts — this is appropriate for this difficulty
- DO NOT rewrite easy questions to make them harder — only fix genuine errors (wrong answer, broken diagram dependency, factual mistake)`
      : difficulty === "Medium"
      ? `REQUIRED STANDARD: Medium (Cambridge IGCSE Grade A–C level)
- Target: 40–60% of students should answer correctly
- Command words: Describe, Explain, Calculate (2–3 steps), Show, Determine
- Must apply knowledge to a scenario — not pure recall, but not requiring novel synthesis
- Rewrite ONLY if the question is genuinely too easy (pure recall, 1-step) or has a broken diagram`
      : `REQUIRED STANDARD: Challenging (Cambridge IGCSE A* discriminator)
- Target: Only 10–20% of students answer fully correctly
- Command words: Evaluate, Deduce, Predict, Suggest, Discuss, Justify — NEVER State/Name/Define
- Must require 3+ distinct cognitive steps or multi-stage synthesis
- Content must be in UNFAMILIAR context — novel scenario, never a textbook example
- Mark schemes must have 4+ distinct marking points for 4+ mark questions`;

  const rewriteConditions =
    difficulty === "Easy"
      ? `REWRITE ONLY IF:
- The answer in the mark scheme is factually wrong
- A diagram is present but completely irrelevant to the question
- The question accidentally requires university-level knowledge`
      : difficulty === "Medium"
      ? `REWRITE IF:
- Question is pure recall (no application to a scenario)
- Can be solved in a single arithmetic step with no reasoning
- Diagram (if present) is not used in solving the question
- Mark scheme is missing key steps for a multi-step question`
      : `REWRITE ANY QUESTION THAT:
- Can be solved in 1 step
- Does not require diagram (if present)
- Looks like a textbook example ("Find x")
- Uses predictable patterns
- Is too easy for A* candidates
- a student can answer from memory alone`;

  const prompt = `You are a Cambridge IGCSE Chief Examiner conducting a quality audit for ${subject}.

${difficultyStandard}

${rewriteConditions}

CRITICAL DIAGRAM CHECK (applies to ALL difficulty levels):
- If a question has a diagram, is the diagram ESSENTIAL to solve it?
- If the question can be solved without looking at the diagram, rewrite it so the diagram contains vital info (e.g. lengths, angles, relationships) not stated in the text.

QUESTIONS TO AUDIT:
${questionsText}

TASK:
1. Audit each question for quality, difficulty, and diagram dependency.
2. REWRITE any question that:
   - Is too easy (recall only).
   - Does not require the diagram (if present).
   - Uses textbook phrasing.
3. When rewriting:
   - Place in unfamiliar context.
   - Increase synthesis steps.
   - Ensure diagram is vital to the solution.
4. Keep the same syllabus topic and mark allocation.
5. Return ALL ${questions.length} questions (revised or unchanged).`;

  const raw = await withRetry(
    async () => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 65536,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    answer: { type: Type.STRING },
                    markScheme: { type: Type.STRING },
                    marks: { type: Type.NUMBER },
                    commandWord: { type: Type.STRING },
                    type: { type: Type.STRING },
                    hasDiagram: { type: Type.BOOLEAN },
                    syllabusObjective: { type: Type.STRING, nullable: true },
                    assessmentObjective: { type: Type.STRING, nullable: true },
                    difficultyStars: { type: Type.NUMBER, nullable: true },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: [
                    "text",
                    "answer",
                    "markScheme",
                    "marks",
                    "commandWord",
                    "type",
                    "hasDiagram",
                    "options",
                  ],
                },
              },
            },
            required: ["questions"],
          },
          systemInstruction: `You are a Senior Cambridge IGCSE Chief Examiner. Your job is to ensure questions meet Cambridge standards. Be ruthless: any question solvable without its diagram (if present) or answerable from memory must be rewritten.`,
        },
      });
      const usage = getGeminiUsage(response);
      if (usage) onUsage?.(model, usage.inputTokens, usage.outputTokens);
      return safeJsonParse(response.text || "{}") as { questions: any[] };
    },
    3,
    onRetry,
  );
  return (raw.questions ?? []).map((q, i) => {
    const existing = questions[i];

    // Diagram questions: preserve as-is — critique AI doesn't know the diagram
    // contents and will break the question if allowed to rewrite it.
    if (existing?.hasDiagram && existing?.diagram) {
      return { ...existing };
    }

    const sanitized = sanitizeQuestion(q);
    return {
      ...sanitized,
      diagram: existing?.diagram,
      hasDiagram: existing?.hasDiagram ?? sanitized.hasDiagram,
      id: existing?.id ?? crypto.randomUUID(),
      code:
        existing?.code ??
        sharedGenerateQuestionCode(subject, {
          text: sanitized.text,
          syllabusObjective: sanitized.syllabusObjective,
        }),
    };
  });
}

export async function auditTest(
  subject: string,
  assessment: Assessment,
  model: string = "gemini-3.1-pro-preview",
  apiKey?: string,
  onUsage?: UsageCallback,
): Promise<QuestionItem[]> {
  const ai = getAI(apiKey);
  const questionsText = assessment.questions
    .map(
      (q, i) =>
        `**Q${i + 1}** [${q.marks} marks] (${q.commandWord})\n${q.text}\n\nAnswer: ${q.answer}\n\nMark Scheme: ${q.markScheme}`,
    )
    .join("\n\n---\n\n");

  const prompt = `You are a Principal Cambridge IGCSE Examiner and Chief Moderator for ${subject}.
Your task: rigorously audit this assessment against CAIE standards and return a corrected version.

ASSESSMENT TO REVIEW:
---
${questionsText}
---

AUDIT CRITERIA (fix ALL violations):
1. **Command Words**: Verify each command word matches its CAIE definition. "Describe" ≠ "Explain". "State" ≠ "Describe". Fix mismatches.
2. **Mark Scheme Format**: Each point must be numbered ("1. ...", "2. ..."). Alternatives must use "Accept: ..." format. Level descriptors required for ≥3 mark extended writing. Fix any paragraph-style mark schemes.
3. **Mark Allocation**: Count marking points — they must equal the marks awarded. A 3-mark question needs exactly 3 marking points. Fix mismatches.
4. **Scientific/Mathematical Accuracy**: Check all facts, equations, calculations, chemical formulae, state symbols, SI units. Fix any errors.
5. **Structured Question Format**: Multi-part questions (4+ marks) must have **(a)**, **(b)**, **(c)** sub-parts with individual mark allocations **[n]**. Fix any that don't.
6. **LaTeX**: All mathematical/chemical expressions must be in LaTeX delimiters. Fix plain-text math.
7. **syllabusObjective**: Must follow "REF – statement" format. Fix if missing or malformed.

Return the ENTIRE assessment with ALL questions (corrected or unchanged).`;

  const raw = await withRetry(async () => {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  answer: { type: Type.STRING },
                  markScheme: { type: Type.STRING },
                  marks: { type: Type.NUMBER },
                  commandWord: { type: Type.STRING },
                  type: { type: Type.STRING },
                  hasDiagram: { type: Type.BOOLEAN },
                  syllabusObjective: { type: Type.STRING, nullable: true },
                  assessmentObjective: { type: Type.STRING, nullable: true },
                  difficultyStars: { type: Type.NUMBER, nullable: true },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  // diagram field removed
                },
                required: [
                  "text",
                  "answer",
                  "markScheme",
                  "marks",
                  "commandWord",
                  "type",
                  "hasDiagram",
                  "options",
                ],
              },
            },
          },
          required: ["questions"],
        },
      },
    });
    const usage = getGeminiUsage(response);
    if (usage) onUsage?.(model, usage.inputTokens, usage.outputTokens);
    return safeJsonParse(response.text || "{}") as {
      questions: Omit<QuestionItem, "id">[];
    };
  });
  return (raw.questions ?? []).map((q, i) => {
    const sanitized = sanitizeQuestion(q);
    const existing = assessment.questions[i];
    return {
      ...sanitized,
      diagram: existing?.diagram,
      hasDiagram: existing?.hasDiagram ?? sanitized.hasDiagram,
      id: existing?.id ?? crypto.randomUUID(),
      code:
        existing?.code ??
        sharedGenerateQuestionCode(assessment.subject, {
          text: sanitized.text,
          syllabusObjective: sanitized.syllabusObjective,
        }),
    };
  });
}

export async function getStudentFeedback(
  subject: string,
  assessment: Assessment,
  studentAnswers: string[],
  modelName: string = "gemini-3-flash-preview",
  apiKey?: string,
): Promise<string> {
  const ai = getAI(apiKey);
  const questionsText = assessment.questions
    .map(
      (q, i) =>
        `**Q${i + 1}** [${q.marks} marks]\n${q.text}\n\nMark Scheme: ${q.markScheme}`,
    )
    .join("\n\n");
  const answersText = studentAnswers
    .map((a, i) => `Q${i + 1}: ${a || "(no answer)"}`)
    .join("\n");

  const prompt = `
    You are an expert Cambridge IGCSE Examiner for ${subject}.

    TASK:
    Evaluate the student's answers based on the provided questions and mark scheme.

    QUESTIONS AND MARK SCHEMES:
    ${questionsText}

    STUDENT ANSWERS:
    ${answersText}

    INSTRUCTIONS:
    1. Be strict but fair, following the Cambridge assessment objectives.
    2. For each question, indicate if it's correct, partially correct, or incorrect.
    3. Provide specific feedback on how to improve, referencing the "Command Words" if applicable.
    4. Give an estimated mark for each section.
    5. Summarize the student's performance and provide 3 key areas for improvement.
    6. Use Markdown for formatting.
  `;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction:
          "You are a professional Cambridge IGCSE examiner. Provide constructive, precise feedback based on official mark schemes.",
      },
    }),
  );

  return response.text || "Could not generate feedback.";
}

// sanitizeQuestion is now imported from './sanitize'

function safeJsonParse(text: string) {
  return parseJsonWithRecovery(text || "{}", "Gemini");
}

/** Fetch an image URL and return base64 + mimeType for Gemini inlineData. */
async function fetchImageAsBase64Util(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const mimeType = blob.type || 'image/png'
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result as string
        const base64 = dataUrl.split(',')[1]
        resolve(base64 ? { data: base64, mimeType } : null)
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function getGeminiUsage(
  response: any,
): { inputTokens: number; outputTokens: number } | null {
  const meta = response?.usageMetadata ?? response?.usage ?? null;
  if (!meta) return null;
  const inputTokens = Number(
    meta.promptTokenCount ?? meta.inputTokens ?? meta.prompt_tokens ?? 0,
  );
  const outputTokens = Number(
    meta.candidatesTokenCount ??
      meta.outputTokens ??
      meta.completion_tokens ??
      0,
  );
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens))
    return null;
  if (inputTokens <= 0 && outputTokens <= 0) return null;
  return { inputTokens, outputTokens };
}

export async function analyzeFile(
  base64Data: string,
  mimeType: string,
  subject: string,
  count: number = 3,
  model: string = "gemini-3-flash-preview",
  references?: Reference[],
  apiKey?: string,
): Promise<AnalyzeFileResult> {
  const ai = getAI(apiKey);
  const isPdf = mimeType === "application/pdf";
  const prompt = `Analyze this ${isPdf ? "past paper PDF" : "screenshot"} of a Cambridge IGCSE ${subject} question.
1. Explain the topic and learning objectives it covers.
2. Generate EXACTLY ${count} similar questions with the same concept but different context.
3. For Science subjects, indicate if a diagram is needed by setting hasDiagram=true. Do not generate SVG.
4. Each question must have: text, answer, markScheme, marks, commandWord, type (mcq/short_answer/structured), hasDiagram.
5. **FORMATTING**: Use clean markdown with clear spacing for options. Do NOT append a separate Syllabus Reference line.`;

  const parts: any[] =
    references && references.length > 0 ? buildReferenceParts(references) : [];

  parts.push({
    inlineData: {
      mimeType: mimeType,
      data: base64Data.split(",")[1] || base64Data,
    },
  });

  parts.push({ text: prompt });

  const raw = await withRetry(async () => {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  answer: { type: Type.STRING },
                  markScheme: { type: Type.STRING },
                  marks: { type: Type.NUMBER },
                  commandWord: { type: Type.STRING },
                  type: { type: Type.STRING },
                  hasDiagram: { type: Type.BOOLEAN },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: [
                  "text",
                  "answer",
                  "markScheme",
                  "marks",
                  "commandWord",
                  "type",
                  "hasDiagram",
                  "options",
                ],
              },
            },
          },
          required: ["analysis", "questions"],
        },
        systemInstruction: `You are an expert Cambridge IGCSE ${subject} assessment designer.
Analyze past paper questions with high precision and generate similar questions.
Do NOT use SVG. Use hasDiagram=true for questions requiring diagrams.`,
      },
    });
    return safeJsonParse(response.text || "{}");
  });
  return {
    analysis: raw.analysis ?? "",
    questions: (raw.questions ?? []).map((q: any) => {
      const sanitized = sanitizeQuestion(q);
      return {
        ...sanitized,
        id: crypto.randomUUID(),
        code: sharedGenerateQuestionCode(subject, {
          text: sanitized.text,
          syllabusObjective: sanitized.syllabusObjective,
        }),
      };
    }),
  };
}

// ── PDF Question Parser ───────────────────────────────────────────────────────

export interface ParsedPdfQuestion {
  id: string
  text: string          // question text, math as $...$ or $$...$$
  markScheme: string    // mark scheme / answer, math as $...$ or $$...$$
  marks: number
  type: 'mcq' | 'short_answer' | 'structured'
  options?: string[]    // MCQ options A-D
  commandWord: string
  topic: string         // best guess from content
  assessmentObjective: 'AO1' | 'AO2' | 'AO3'
}

/**
 * Send a PNG (as base64 data URL) to Gemini vision and extract all exam
 * questions found on the page/crop. Math symbols are returned as LaTeX
 * inline ($...$) or display ($$...$$) delimiters.
 *
 * @param isCrop - true when image is a user-drawn selection crop (not full page).
 *                 Tells Gemini to extract ONLY what is fully visible in the image.
 */
export async function parsePdfQuestionsWithGemini(
  imageDataUrl: string,   // "data:image/png;base64,..."
  subject: string,
  apiKey: string,
  model = 'gemini-2.5-flash',
  isCrop = false,
): Promise<ParsedPdfQuestion[]> {
  const ai = getAI(apiKey)

  // Strip the data URL prefix to get raw base64
  const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '')

  const scopeInstruction = isCrop
    ? `This image is a user-selected crop of an exam page. Extract ONLY the question(s) that appear FULLY or SUBSTANTIALLY within this cropped region. Do NOT infer or include questions from outside the visible area. If a question appears only partially cut off at the edge, still include it — but never add questions that are not present in the image at all.`
    : `Carefully read the exam page image and extract ALL exam questions visible.`

  const prompt = `You are an expert Cambridge IGCSE ${subject} examiner.

${scopeInstruction}

Rules:
- Represent ALL mathematical symbols, formulae, and expressions using LaTeX delimiters:
  - Inline math: $...$ (e.g. $x^2 + 2x - 3$, $\frac{a}{b}$, $\sqrt{x}$)
  - Display/block math: $$...$$ for standalone equations
- Preserve sub-parts: if a question has (a), (b), (c) parts, combine them into one structured question with the parts clearly labelled in the text field.
- For MCQ questions, list the four options in the "options" array.
- For the mark scheme, write the expected answer or marking points. Include LaTeX math where needed.
- "commandWord": the Cambridge command word (State, Describe, Explain, Calculate, Show, Define, Suggest, Evaluate, etc.). Use "State" if unclear.
- "assessmentObjective": AO1 (recall/knowledge), AO2 (application), AO3 (analysis/evaluation). Use AO1 if unclear.
- "topic": your best guess at the syllabus topic based on the content.
- If no questions are visible (e.g. page is a cover page or blank), return an empty array.

Return ONLY a valid JSON array with this schema (no markdown, no explanation):
[
  {
    "text": "question text with LaTeX math",
    "markScheme": "expected answer with LaTeX math",
    "marks": 2,
    "type": "short_answer",
    "commandWord": "Describe",
    "topic": "Cell biology",
    "assessmentObjective": "AO2",
    "options": []
  }
]`

  const response = await ai.models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'image/png', data: base64 } },
        { text: prompt },
      ],
    }],
    config: { temperature: 0.1 },
  })

  const raw = safeJsonParse(response.text ?? '[]')
  const arr: ParsedPdfQuestion[] = (Array.isArray(raw) ? raw : []).map((q: any) => ({
    id: crypto.randomUUID(),
    text: String(q.text ?? ''),
    markScheme: String(q.markScheme ?? ''),
    marks: typeof q.marks === 'number' ? q.marks : 1,
    type: (['mcq', 'short_answer', 'structured'].includes(q.type) ? q.type : 'short_answer') as ParsedPdfQuestion['type'],
    options: Array.isArray(q.options) && q.options.length > 0 ? q.options.map(String) : undefined,
    commandWord: String(q.commandWord ?? 'State'),
    topic: String(q.topic ?? subject),
    assessmentObjective: (['AO1', 'AO2', 'AO3'].includes(q.assessmentObjective) ? q.assessmentObjective : 'AO1') as ParsedPdfQuestion['assessmentObjective'],
  }))
  return arr
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface GenerateFromDiagramConfig {
  subject: string
  topic: string
  type: 'mcq' | 'short_answer' | 'structured'
  difficulty: 1 | 2 | 3          // 1=easy 2=medium 3=hard
  marks: number
  assessmentObjective: 'AO1' | 'AO2' | 'AO3'
}

export interface GeneratedDiagramQuestion {
  text: string
  markScheme: string
  marks: number
  type: 'mcq' | 'short_answer' | 'structured'
  options?: string[]
  commandWord: string
  topic: string
  assessmentObjective: 'AO1' | 'AO2' | 'AO3'
  difficultyStars: 1 | 2 | 3
  syllabusObjective: string
}

/**
 * Generate a single Cambridge IGCSE exam question grounded in a specific diagram.
 * The diagram image URL is fetched and sent to Gemini vision.
 */
export async function generateQuestionFromDiagram(
  imageURL: string,
  config: GenerateFromDiagramConfig,
  apiKey: string,
  model = 'gemini-2.5-flash',
): Promise<GeneratedDiagramQuestion> {
  const ai = getAI(apiKey)

  const imgB64 = await fetchImageAsBase64Util(imageURL)
  if (!imgB64) throw new Error('Could not fetch diagram image. Check your connection.')

  const difficultyLabel = config.difficulty === 1 ? 'easy (straightforward recall/application)' : config.difficulty === 2 ? 'medium (requires some reasoning)' : 'hard (multi-step or higher-order thinking)'
  const typeGuide = config.type === 'mcq'
    ? 'Write a 4-option MCQ. The "options" array must have exactly 4 strings (A, B, C, D — without the letter prefix, just the answer text). The correct answer goes in markScheme as the letter only (e.g. "B").'
    : config.type === 'structured'
    ? 'Write a structured question with sub-parts (a), (b), (c). Combine all sub-parts into the "text" field. The markScheme should address each sub-part.'
    : 'Write a short-answer question requiring a written response.'

  const prompt = `You are a Cambridge IGCSE ${config.subject} examiner writing a NEW exam question based on the diagram shown.

The diagram is provided as an image — study it carefully before writing the question.

Requirements:
- Subject: ${config.subject}
- Topic hint: ${config.topic || 'infer from diagram'}
- Question type: ${config.type} — ${typeGuide}
- Difficulty: ${difficultyLabel}
- Marks: ${config.marks}
- Assessment objective: ${config.assessmentObjective}

Rules:
- The question MUST refer directly to the diagram (use "the diagram", "the graph", "shape A", etc.)
- All math in LaTeX: inline $...$, display $$...$$
- commandWord: Cambridge command word (State, Describe, Explain, Calculate, Show, Find, etc.)
- syllabusObjective: "REF – statement" format, e.g. "C2.3 – Describe transformations"
- markScheme: concise marking points matching the marks value

Return ONLY a single JSON object (no markdown, no explanation):
{
  "text": "question text referencing the diagram, math in $...$",
  "markScheme": "mark scheme with marking points",
  "marks": ${config.marks},
  "type": "${config.type}",
  "options": [],
  "commandWord": "Describe",
  "topic": "${config.topic || config.subject}",
  "assessmentObjective": "${config.assessmentObjective}",
  "difficultyStars": ${config.difficulty},
  "syllabusObjective": "REF – statement"
}`

  const response = await ai.models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: imgB64.mimeType, data: imgB64.data } },
        { text: prompt },
      ],
    }],
    config: { temperature: 0.7, responseMimeType: 'application/json' },
  })

  const raw = safeJsonParse(response.text ?? '{}')
  if (!raw || typeof raw !== 'object') throw new Error('Gemini returned invalid JSON')

  const q = raw as Record<string, unknown>
  return {
    text: String(q.text ?? ''),
    markScheme: String(q.markScheme ?? ''),
    marks: typeof q.marks === 'number' ? q.marks : config.marks,
    type: (['mcq', 'short_answer', 'structured'].includes(String(q.type)) ? q.type : config.type) as GeneratedDiagramQuestion['type'],
    options: config.type === 'mcq' && Array.isArray(q.options) && q.options.length >= 4 ? (q.options as unknown[]).slice(0, 4).map(String) : undefined,
    commandWord: String(q.commandWord ?? 'Describe'),
    topic: String(q.topic ?? config.topic ?? config.subject),
    assessmentObjective: (['AO1', 'AO2', 'AO3'].includes(String(q.assessmentObjective)) ? q.assessmentObjective : config.assessmentObjective) as GeneratedDiagramQuestion['assessmentObjective'],
    difficultyStars: ([1, 2, 3].includes(Number(q.difficultyStars)) ? Number(q.difficultyStars) : config.difficulty) as 1 | 2 | 3,
    syllabusObjective: String(q.syllabusObjective ?? ''),
  }
}
