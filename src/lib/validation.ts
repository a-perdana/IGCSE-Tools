/**
 * Hard validation helpers for Cambridge IGCSE A* question quality.
 * Used in Phase 4.5 of question generation (Challenging difficulty only).
 */
import type { QuestionItem } from "./types";

export function hasMultiStepStructure(q: QuestionItem): boolean {
  return (
    q.text.includes("(a)") ||
    q.text.includes("(b)") ||
    /show that|hence|deduce|explain why/i.test(q.text)
  );
}

export function requiresGeometricUse(q: QuestionItem): boolean {
  const text = q.text.toLowerCase();
  return (
    /angle|triangle|circle|radius|diameter|parallel|line/.test(text) &&
    /calculate|determine|deduce|show|prove|justify/.test(text)
  );
}

export function hasCognitiveLoad(q: QuestionItem): boolean {
  return (
    q.text.split(".").length >= 2 || // multi-sentence
    q.text.includes("(a)") ||
    q.text.includes("(b)") ||
    /hence|deduce|explain why|show that/i.test(q.text)
  );
}

export function isAStarLevel(q: QuestionItem, difficulty?: string): boolean {
  if (difficulty === "Challenging") {
    // Strict: all conditions required for A* level
    return (
      q.marks >= 3 &&
      hasMultiStepStructure(q) &&
      hasCognitiveLoad(q) &&
      /deduce|justify|prove|show that|explain/i.test(q.text)
    );
  }
  if (difficulty === "Medium" || difficulty === "Balanced") {
    // Softer: multi-step structure and cognitive load sufficient
    return hasMultiStepStructure(q) && hasCognitiveLoad(q);
  }
  // Easy: always pass
  return true;
}

export function requiresDiagramExtraction(q: QuestionItem): boolean {
  return !q.text.toLowerCase().includes("given") && q.hasDiagram;
}

/**
 * Hard Validation Layer for Cambridge IGCSE A* Quality
 */
export function enforceQuestionQuality(q: QuestionItem): {
  isValid: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  // 1. DIAGRAM DEPENDENCY
  if (q.hasDiagram) {
    const diagramRefs =
      /\b(diagram|figure|shown|point\s+[A-Z]|angle\s+[A-Z]{2,3}|triangle\s+[A-Z]{3})\b/i;
    if (!diagramRefs.test(q.text)) {
      reasons.push(
        "Diagram provided but not referenced in text (must use 'diagram', 'figure', or specific points).",
      );
    }

    if (!requiresGeometricUse(q)) {
      reasons.push("Diagram is mentioned but not used geometrically.");
    }
  }

  // 2. MULTI-STEP CHECK & 6. DIFFICULTY ENFORCER
  const reasoningVerbs =
    /\b(explain|deduce|determine|justify|show|prove|calculate)\b/i;
  if (
    q.marks <= 2 &&
    !reasoningVerbs.test(q.commandWord || "") &&
    !reasoningVerbs.test(q.text)
  ) {
    reasons.push(
      "Question is too simple (low marks and no reasoning required).",
    );
  }

  if (q.type !== "mcq" && !hasMultiStepStructure(q)) {
    reasons.push("Question lacks multi-step reasoning structure.");
  }

  if (!hasCognitiveLoad(q)) {
    reasons.push("Low cognitive load (too direct / single-step).");
  }

  // 3. TEXTBOOK DETECTION
  const textbookPatterns =
    /^(find\s+[a-z]+|calculate\s+[a-z]{1,2}|what\s+is\s+the\s+value\s+of)\s*$/i;
  if (textbookPatterns.test(q.text.trim()) && q.text.length < 60) {
    reasons.push("Question lacks context (textbook style 'Find x').");
  }

  if (q.hasDiagram && !requiresDiagramExtraction(q)) {
    reasons.push(
      "Question provides values in text (avoid 'given', force extraction).",
    );
  }

  return { isValid: reasons.length === 0, reasons };
}

export function isTooEasy(q: QuestionItem): boolean {
  // Check if question is trivial (1-2 marks and no cognitive verbs)
  return (
    q.marks <= 2 &&
    !/explain|justify|deduce|determine|prove|calculate/i.test(
      q.commandWord + " " + q.text,
    )
  );
}
