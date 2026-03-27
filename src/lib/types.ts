import { Timestamp } from "firebase/firestore";
import type { DiagramDSL } from "./mathEngine";

export type { DiagramDSL };

export interface TikzSpec {
  diagramType: 'tikz'
  code: string
  maxWidth?: number   // px, default 480
  minHeight?: number  // px, default 0
}

/** Raster image diagram — used for imported past-paper question images. */
export interface RasterSpec {
  diagramType: 'raster'
  url: string
  maxWidth?: number   // px, default 480
}

export interface QuestionItem {
  id: string;
  text: string;
  answer: string;
  markScheme: string;
  marks: number;
  commandWord: string;
  type: "mcq" | "short_answer" | "structured";
  hasDiagram: boolean;
  diagram?: TikzSpec | RasterSpec;
  /** Structured diagram DSL — single source of truth for all geometry */
  diagramDSL?: DiagramDSL;
  /** @deprecated Use diagramDSL instead */
  diagramType?: string;
  /** @deprecated Use diagramDSL instead */
  diagramData?: any;
  diagramMissing?: boolean;
  isValid?: boolean;
  code?: string;
  syllabusObjective?: string;
  assessmentObjective?: "AO1" | "AO2" | "AO3";
  difficultyStars?: 1 | 2 | 3;
  options?: string[];
}

export interface Assessment {
  id: string;
  subject: string;
  topic: string;
  difficulty: string;
  questions: QuestionItem[];
  userId: string;
  folderId?: string;
  createdAt: Timestamp;
  code?: string;
  isPublic?: boolean;
  preparedBy?: string;
}

export interface Question extends QuestionItem {
  assessmentId?: string;
  subject: string;
  topic: string;
  difficulty: string;
  userId: string;
  folderId?: string;
  createdAt: Timestamp;
  isPublic?: boolean;
  preparedBy?: string;
}

export interface Folder {
  id: string;
  name: string;
  userId: string;
  createdAt: Timestamp;
  parentId?: string;
  order?: number;
}

export type ResourceType = 'past_paper' | 'syllabus' | 'other';

export interface Resource {
  id: string;
  name: string;
  subject: string;
  storagePath: string;
  downloadURL: string;
  mimeType: string;
  userId: string;
  createdAt: Timestamp;
  resourceType?: ResourceType;
  isShared?: boolean;
  geminiFileUri?: string;
  geminiFileUploadedAt?: Timestamp | number;
}

export type AIProvider = 'gemini' | 'openai' | 'anthropic';

export interface GenerationConfig {
  subject: string;
  topic: string;
  difficulty: string;
  count: number;
  type: string;
  calculator: boolean;
  model: string;
  syllabusContext?: string;
  provider?: AIProvider;
  useDiagramPool?: boolean;
}

export interface AnalyzeFileResult {
  analysis: string;
  questions: QuestionItem[];
}

export interface AIError {
  type:
    | "rate_limit"
    | "quota_exceeded"
    | "invalid_key"
    | "model_overloaded"
    | "invalid_response"
    | "network"
    | "unknown";
  retryable: boolean;
  message: string;
}

export interface GeminiError {
  type:
    | "rate_limit"
    | "model_overloaded"
    | "invalid_response"
    | "network"
    | "unknown";
  retryable: boolean;
  message: string;
}

export interface Notification {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  dismissAt: number;
}

// ─── Imported past-paper questions ───────────────────────────────────────────
// Written by the Admin SDK import script; read-only for app users.

export interface ImportedQuestion {
  uid: string;                          // "biol_0001"
  source: 'imported';
  subjectCode: string;                  // "0610"
  subject: string;                      // "Biology"
  rawCode: string;                      // "0610/12/F/M/2024-1"
  paperCode: string;                    // "0610/12/F/M/2024"
  paper: '1' | '2' | 'specimen' | '';
  session: string;                      // "F/M" | "O/N" | "M/J"
  year: string;                         // "2024"
  questionNumber: number | null;
  topic: string;
  subtopic: string | null;
  type: 'mcq';
  questionText: string;
  options: string[];                    // [textA, textB, textC, textD]
  correctAnswer: string | null;         // null — not available in source
  hasImage: boolean;
  imageName: string | null;
  allImageNames: string[];
  imageStoragePath: string | null;
  imageURL: string | null;
  status: 'active' | 'archived';
  isPublic: true;
  createdAt: Timestamp;
  importedAt: Timestamp;
}

// ─── Diagram pool ─────────────────────────────────────────────────────────────
// Diagrams extracted from imported questions, available for reuse during
// AI question generation.

export type DiagramCategory =
  | 'diagram'    // scientific / schematic diagram
  | 'table'      // data table rendered as image
  | 'photo'      // photograph of organism / specimen
  | 'graph'      // graph / chart
  | 'other';

export interface DiagramPoolEntry {
  id: string;
  imageName: string;              // original filename, e.g. "image141.png"
  storagePath: string;            // "diagrams/biology/image141.png"
  imageURL: string;               // Firebase Storage public URL
  subject: string;                // "Biology"
  topics: string[];               // associated syllabus topics
  tags: string[];                 // free-form tags
  description: string;            // short human-readable description
  category: DiagramCategory;
  usedInQuestionUids: string[];   // ImportedQuestion.uid references
  createdAt: Timestamp;
}

export interface SyllabusCache {
  resourceId: string;
  subject: string;
  topics: Record<string, string>;
  processedAt: Timestamp;
  userId: string | null;
}

export interface PastPaperCache {
  resourceId: string;
  subject: string;
  examples?: string;
  summary?: string;
  version?: number;
  processedAt: Timestamp;
  userId: string | null;
  items?: Array<{
    questionText: string;
    commandWord: string;
    marks: number;
    markScheme: string;
    questionType?: string;
    difficultyBand?: string;
    topic?: string;
    assessmentObjective?: string;
    tikzCode?: string;
  }>;
}
