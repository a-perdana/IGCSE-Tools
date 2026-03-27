import { describe, it, expect } from "vitest";
import {
  sanitizeQuestion,
  normalizeDiagram,
  repairQuestionItem,
  generateQuestionCode,
} from "../sanitize";

// ── normalizeDiagram ──────────────────────────────────────────────────────────

describe("normalizeDiagram", () => {
  it("returns undefined for null/undefined", () => {
    expect(normalizeDiagram(null)).toBeUndefined();
    expect(normalizeDiagram(undefined)).toBeUndefined();
  });

  it("returns undefined for non-object", () => {
    expect(normalizeDiagram("string")).toBeUndefined();
    expect(normalizeDiagram(42)).toBeUndefined();
  });

  it("returns undefined if diagramType is not 'tikz'", () => {
    expect(normalizeDiagram({ diagramType: "raster", code: "..." })).toBeUndefined();
  });

  it("returns undefined if code is empty", () => {
    expect(normalizeDiagram({ diagramType: "tikz", code: "   " })).toBeUndefined();
  });

  it("normalises a valid tikz spec with code field", () => {
    const result = normalizeDiagram({ diagramType: "tikz", code: "\\begin{tikzpicture}\\end{tikzpicture}" });
    expect(result).toEqual({
      diagramType: "tikz",
      code: "\\begin{tikzpicture}\\end{tikzpicture}",
    });
  });

  it("normalises a legacy tikzCode field", () => {
    const result = normalizeDiagram({ diagramType: "tikz", tikzCode: "\\begin{tikzpicture}\\end{tikzpicture}" });
    expect(result).toEqual({
      diagramType: "tikz",
      code: "\\begin{tikzpicture}\\end{tikzpicture}",
    });
  });
});

// ── sanitizeQuestion — MCQ option validation ──────────────────────────────────

describe("sanitizeQuestion — MCQ", () => {
  it("keeps type mcq when exactly 4 non-empty options provided", () => {
    const q = {
      text: "What is 2 + 2?",
      type: "mcq",
      options: ["3", "4", "5", "6"],
      answer: "4",
      markScheme: "B",
      marks: 1,
    };
    const result = sanitizeQuestion(q);
    expect(result.type).toBe("mcq");
    expect(result.options).toHaveLength(4);
  });

  it("downgrades to short_answer when only 3 options provided", () => {
    const q = {
      text: "What is 2 + 2?",
      type: "mcq",
      options: ["3", "4", "5"],
      answer: "4",
      markScheme: "B",
      marks: 1,
    };
    const result = sanitizeQuestion(q);
    expect(result.type).toBe("short_answer");
    expect(result.options).toBeUndefined();
  });

  it("downgrades to short_answer when options contains empty strings", () => {
    const q = {
      text: "What is 2 + 2?",
      type: "mcq",
      options: ["3", "4", "", "6"],
      answer: "4",
      markScheme: "B",
      marks: 1,
    };
    const result = sanitizeQuestion(q);
    expect(result.type).toBe("short_answer");
  });

  it("downgrades to short_answer when no options provided", () => {
    const q = {
      text: "What is 2 + 2?",
      type: "mcq",
      options: [],
      answer: "4",
      markScheme: "B",
      marks: 1,
    };
    const result = sanitizeQuestion(q);
    expect(result.type).toBe("short_answer");
  });

  it("extracts options from question text if model options are missing", () => {
    const q = {
      text: "Which of the following is correct?\n\nA) 2 + 2 = 3\nB) 2 + 2 = 4\nC) 2 + 2 = 5\nD) 2 + 2 = 6",
      type: "mcq",
      options: [],
      answer: "B",
      markScheme: "B",
      marks: 1,
    };
    const result = sanitizeQuestion(q);
    expect(result.type).toBe("mcq");
    expect(result.options).toHaveLength(4);
  });

  it("strips option letter prefix from extracted text options", () => {
    const q = {
      text: "Pick one:\n\nA) alpha\nB) beta\nC) gamma\nD) delta",
      type: "mcq",
      options: ["A) alpha", "B) beta", "C) gamma", "D) delta"],
      answer: "A",
      markScheme: "A",
      marks: 1,
    };
    const result = sanitizeQuestion(q);
    // options should not have the "A)" prefix
    expect(result.options?.[0]).toBe("alpha");
  });
});

// ── sanitizeQuestion — type normalisation ──────────────────────────────────────

describe("sanitizeQuestion — type normalisation", () => {
  it("normalises 'multiple_choice' to mcq", () => {
    const q = {
      text: "Q?",
      type: "multiple_choice",
      options: ["a", "b", "c", "d"],
      answer: "a",
      markScheme: "",
      marks: 1,
    };
    const result = sanitizeQuestion(q);
    expect(result.type).toBe("mcq");
  });

  it("normalises 'essay' to structured", () => {
    const q = { text: "Q?", type: "essay", answer: "a", markScheme: "", marks: 4 };
    const result = sanitizeQuestion(q);
    expect(result.type).toBe("structured");
  });

  it("defaults unknown type to short_answer", () => {
    const q = { text: "Q?", type: "unknown_type", answer: "a", markScheme: "", marks: 1 };
    const result = sanitizeQuestion(q);
    expect(result.type).toBe("short_answer");
  });
});

// ── sanitizeQuestion — TikZ extraction from text ─────────────────────────────

describe("sanitizeQuestion — TikZ extraction from text", () => {
  it("extracts tikz code block from text and stores as diagram", () => {
    const tikzCode = "\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}";
    const q = {
      text: `Draw the shape.\n\`\`\`tikz\n${tikzCode}\n\`\`\`\nEnd of question.`,
      type: "short_answer",
      answer: "",
      markScheme: "",
      marks: 2,
    };
    const result = sanitizeQuestion(q);
    expect(result.diagram?.diagramType).toBe("tikz");
    expect((result.diagram as any)?.code).toBe(tikzCode);
    // The fenced block should be removed from text
    expect(result.text).not.toContain("```tikz");
  });

  it("prefers q.diagram over extracted tikz from text", () => {
    const explicitDiagram = { diagramType: "tikz", code: "\\begin{tikzpicture}A\\end{tikzpicture}" };
    const q = {
      text: "Q?\n```tikz\n\\begin{tikzpicture}B\\end{tikzpicture}\n```",
      type: "short_answer",
      answer: "",
      markScheme: "",
      marks: 2,
      diagram: explicitDiagram,
    };
    const result = sanitizeQuestion(q);
    expect((result.diagram as any)?.code).toBe(explicitDiagram.code);
  });
});

// ── sanitizeQuestion — marks and assessmentObjective ─────────────────────────

describe("sanitizeQuestion — fields", () => {
  it("defaults marks to 1 when missing or non-numeric", () => {
    const q = { text: "Q?", type: "short_answer", answer: "", markScheme: "" };
    expect(sanitizeQuestion(q).marks).toBe(1);
  });

  it("preserves numeric marks", () => {
    const q = { text: "Q?", type: "short_answer", answer: "", markScheme: "", marks: 5 };
    expect(sanitizeQuestion(q).marks).toBe(5);
  });

  it("extracts AO1 from assessmentObjective", () => {
    const q = { text: "Q?", type: "short_answer", answer: "", markScheme: "", marks: 1, assessmentObjective: "AO1 – Knowledge" };
    expect(sanitizeQuestion(q).assessmentObjective).toBe("AO1");
  });

  it("ignores unrecognised assessmentObjective", () => {
    const q = { text: "Q?", type: "short_answer", answer: "", markScheme: "", marks: 1, assessmentObjective: "AO5" };
    expect(sanitizeQuestion(q).assessmentObjective).toBeUndefined();
  });

  it("replaces literal \\n escape sequences with newlines in text", () => {
    const q = { text: "Line 1\\nLine 2", type: "short_answer", answer: "", markScheme: "", marks: 1 };
    expect(sanitizeQuestion(q).text).toContain("\n");
  });

  it("strips leading question number from text", () => {
    const q = { text: "1. What is water?", type: "short_answer", answer: "", markScheme: "", marks: 1 };
    const result = sanitizeQuestion(q);
    expect(result.text).not.toMatch(/^1\./);
  });

  it("clamps difficultyStars to 1-3 range for out-of-range values", () => {
    // 0 is falsy — field is omitted entirely (treated as absent)
    const missing = sanitizeQuestion({ text: "Q?", type: "short_answer", answer: "", markScheme: "", marks: 1, difficultyStars: 0 });
    expect(missing.difficultyStars).toBeUndefined();

    // Values above 3 are clamped to 3
    const high = sanitizeQuestion({ text: "Q?", type: "short_answer", answer: "", markScheme: "", marks: 1, difficultyStars: 99 });
    expect(high.difficultyStars).toBe(3);

    // Negative values clamp to 1
    const negative = sanitizeQuestion({ text: "Q?", type: "short_answer", answer: "", markScheme: "", marks: 1, difficultyStars: -5 });
    expect(negative.difficultyStars).toBe(1);
  });
});

// ── repairQuestionItem ────────────────────────────────────────────────────────

describe("repairQuestionItem", () => {
  it("preserves id and diagram from original", () => {
    const original = {
      id: "FIXED-ID",
      text: "Q?",
      type: "mcq" as const,
      commandWord: "State",
      options: ["a", "b", "c", "d"],
      answer: "a",
      markScheme: "",
      marks: 1,
      hasDiagram: true,
      diagram: { diagramType: "tikz" as const, code: "\\begin{tikzpicture}X\\end{tikzpicture}" },
    };
    const repaired = repairQuestionItem(original);
    expect(repaired.id).toBe("FIXED-ID");
    expect((repaired.diagram as any)?.code).toBe(original.diagram.code);
  });
});

// ── generateQuestionCode ──────────────────────────────────────────────────────

describe("generateQuestionCode", () => {
  it("uses 3-letter subject code for known subjects", () => {
    const code = generateQuestionCode("Mathematics", { text: "Q?" });
    expect(code).toMatch(/^MAT-/);
  });

  it("uses first 3 chars for unknown subjects", () => {
    const code = generateQuestionCode("Geography", { text: "Q?" });
    expect(code).toMatch(/^GEO-/);
  });

  it("incorporates syllabus objective into code", () => {
    const code = generateQuestionCode("Physics", { syllabusObjective: "C4.1 – Define acceleration" });
    expect(code).toContain("C4.1");
  });

  it("falls back to GEN when no syllabus objective", () => {
    const code = generateQuestionCode("Biology", { text: "Q?" });
    expect(code).toContain("GEN");
  });

  it("produces format SUBJ-SYL-HASH", () => {
    const code = generateQuestionCode("Chemistry", { text: "Q?" });
    // e.g. CHM-GEN-XXXX
    expect(code).toMatch(/^[A-Z]{3}-[A-Za-z0-9.]+-.+$/);
  });
});
