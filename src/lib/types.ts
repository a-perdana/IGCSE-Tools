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
  isPublic?: boolean;
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

// ─── Class / Shared Assignments ──────────────────────────────────────────────

export interface Classroom {
  id: string
  code: string           // short join code e.g. "CLS-A1B2"
  name: string           // e.g. "Year 10 Biology"
  teacherId: string
  teacherName: string
  studentIds: string[]
  createdAt: Timestamp
}

export interface SharedAssignment {
  id: string
  code: string              // short join code e.g. "BIO-4Q-X7K"
  assessmentId: string
  assessmentSnapshot: {     // denormalised copy so students see it even if teacher edits original
    subject: string
    topic: string
    difficulty: string
    questions: QuestionItem[]
    code?: string
  }
  teacherId: string
  teacherName: string
  createdAt: Timestamp
  expiresAt?: Timestamp     // optional expiry
  timeLimitSeconds?: number // if set, student is forced into exam mode
  studentIds: string[]      // uids of students who joined
  classroomId?: string      // if set, all classroom members can see this assignment
}

export interface AssignmentAttempt {
  id: string
  assignmentId: string
  assignmentCode: string
  userId: string
  displayName: string
  subject: string
  topic: string
  answers: Record<string, { userAnswer: string; isCorrect: boolean; marksAwarded: number; aiFeedback?: string }>
  totalMarks: number
  marksAwarded: number
  durationSeconds: number
  completedAt: Timestamp
}

// ─── Exam Mode ───────────────────────────────────────────────────────────────

export interface ExamAnswerRecord {
  userAnswer: string
  isCorrect: boolean
  marksAwarded: number
  aiFeedback?: string
  criteriaBreakdown?: CriterionResult[]
  syllabusObjective?: string   // copied from QuestionItem at save time
}

export interface ExamAttempt {
  id: string
  userId: string
  assessmentId: string
  subject: string
  topic: string
  timeLimitSeconds: number
  answers: Record<string, ExamAnswerRecord>   // keyed by QuestionItem.id
  totalMarks: number
  marksAwarded: number
  completedAt: Timestamp
  durationSeconds: number
  autoSubmitted: boolean                       // true if timer ran out
}

// ─── Practice Mode ───────────────────────────────────────────────────────────

export interface CriterionResult {
  criterion: string   // short description of the mark-scheme point
  awarded: boolean    // whether the student earned this point
}

export interface PracticeAnswerRecord {
  userAnswer: string
  isCorrect: boolean
  marksAwarded: number
  aiFeedback?: string
  criteriaBreakdown?: CriterionResult[]
  syllabusObjective?: string   // copied from QuestionItem at save time
}

export interface PracticeAttempt {
  id: string
  userId: string
  assessmentId: string
  subject: string
  topic: string
  answers: Record<string, PracticeAnswerRecord>  // keyed by QuestionItem.id
  totalMarks: number
  marksAwarded: number
  completedAt: Timestamp
  durationSeconds: number
}

// ─── Gamification ─────────────────────────────────────────────────────────────

export type BadgeId =
  | 'first_question'       // first question answered
  | 'first_perfect'        // 100% on a session
  | 'streak_3'             // 3-day streak
  | 'streak_7'             // 7-day streak
  | 'streak_30'            // 30-day streak
  | 'questions_10'         // 10 questions answered total
  | 'questions_50'         // 50 questions answered
  | 'questions_100'        // 100 questions answered
  | 'questions_500'        // 500 questions answered
  | 'subject_master'       // 50+ questions in one subject
  | 'daily_3'              // complete first daily challenge
  | 'level_5'              // reach level 5
  | 'level_10'             // reach level 10
  | 'night_owl'            // answered questions after 22:00
  | 'early_bird'           // answered questions before 07:00

export interface BadgeDefinition {
  id: BadgeId
  name: string
  description: string
  emoji: string
  xpReward: number
}

export const BADGE_DEFINITIONS: Record<BadgeId, BadgeDefinition> = {
  first_question:  { id: 'first_question',  name: 'First Step',        description: 'Answer your first question',            emoji: '🎯', xpReward: 50  },
  first_perfect:   { id: 'first_perfect',   name: 'Perfectionist',     description: 'Score 100% on a practice session',      emoji: '💎', xpReward: 200 },
  streak_3:        { id: 'streak_3',        name: 'On a Roll',         description: 'Study 3 days in a row',                 emoji: '🔥', xpReward: 100 },
  streak_7:        { id: 'streak_7',        name: 'Week Warrior',      description: 'Study 7 days in a row',                 emoji: '⚡', xpReward: 300 },
  streak_30:       { id: 'streak_30',       name: 'Unstoppable',       description: 'Study 30 days in a row',                emoji: '🌟', xpReward: 1000 },
  questions_10:    { id: 'questions_10',    name: 'Getting Started',   description: 'Answer 10 questions',                   emoji: '📝', xpReward: 50  },
  questions_50:    { id: 'questions_50',    name: 'Halfway There',     description: 'Answer 50 questions',                   emoji: '📚', xpReward: 150 },
  questions_100:   { id: 'questions_100',   name: 'Century',           description: 'Answer 100 questions',                  emoji: '💯', xpReward: 400 },
  questions_500:   { id: 'questions_500',   name: 'Legend',            description: 'Answer 500 questions',                  emoji: '🏆', xpReward: 1000 },
  subject_master:  { id: 'subject_master',  name: 'Subject Master',    description: 'Answer 50+ questions in one subject',   emoji: '🎓', xpReward: 300 },
  daily_3:         { id: 'daily_3',         name: 'Daily Devotion',    description: 'Complete your first Daily Challenge',   emoji: '📅', xpReward: 100 },
  level_5:         { id: 'level_5',         name: 'Rising Star',       description: 'Reach Level 5',                         emoji: '⭐', xpReward: 200 },
  level_10:        { id: 'level_10',        name: 'Pro Learner',       description: 'Reach Level 10',                        emoji: '🚀', xpReward: 500 },
  night_owl:       { id: 'night_owl',       name: 'Night Owl',         description: 'Study after 10 PM',                     emoji: '🦉', xpReward: 75  },
  early_bird:      { id: 'early_bird',      name: 'Early Bird',        description: 'Study before 7 AM',                     emoji: '🌅', xpReward: 75  },
}

export type IgcseRole = 'student' | 'teacher' | 'admin'

export interface UserProfile {
  uid: string
  role_igcsetools: IgcseRole   // 'student' | 'teacher' | 'admin'
  xp: number
  level: number
  streak: number
  longestStreak: number
  lastActiveDate: string       // 'YYYY-MM-DD' in local time
  totalQuestionsAnswered: number
  totalMarksAwarded: number
  totalMarksPossible: number
  badges: BadgeId[]
  subjectQuestionCounts: Record<string, number>  // subject → count
  dailyChallengesCompleted: number
  updatedAt: number            // Date.now()
}

export interface DailyChallenge {
  date: string                 // 'YYYY-MM-DD'
  questionIds: string[]        // 3 question IDs from user's bank
  completedAt?: number         // Date.now() when done
  marksAwarded?: number
  totalMarks?: number
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
