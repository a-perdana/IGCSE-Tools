/**
 * Unified AI router — delegates to the correct provider based on config.provider.
 */
import type { QuestionItem, Assessment, AnalyzeFileResult, GenerationConfig, PracticeAnswerRecord } from './types'
import { parseJsonWithRecovery } from './json'

import {
  generateTest as geminiGenerateTest,
  auditTest as geminiAuditTest,
  getStudentFeedback as geminiGetStudentFeedback,
  analyzeFile as geminiAnalyzeFile,
} from './gemini'

import {
  generateTest as openaiGenerateTest,
  auditTest as openaiAuditTest,
  getStudentFeedback as openaiGetStudentFeedback,
  analyzeFile as openaiAnalyzeFile,
} from './openai-provider'

import {
  generateTest as anthropicGenerateTest,
  auditTest as anthropicAuditTest,
  getStudentFeedback as anthropicGetStudentFeedback,
  analyzeFile as anthropicAnalyzeFile,
} from './anthropic-provider'

export type PastPaperItem = {
  questionText: string
  commandWord: string
  marks: number
  markScheme: string
  questionType?: string
  difficultyBand?: string
  topic?: string
  tags?: string[]
  assessmentObjective?: string
  tikzCode?: string
}

export type Reference = {
  data: string
  mimeType: string
  resourceType?: string
  name?: string
  geminiFileUri?: string
  geminiFileUploadedAt?: number
  syllabusText?: string
  pastPaperText?: string
  pastPaperItems?: PastPaperItem[]
}

type WithExtra = GenerationConfig & {
  references?: Reference[]
  apiKey?: string
}

export type UsageCallback = (model: string, inputTokens: number, outputTokens: number) => void

export async function generateTest(
  config: WithExtra,
  onRetry?: (attempt: number) => void,
  onUsage?: UsageCallback,
  onLog?: (msg: string) => void,
): Promise<QuestionItem[]> {
  switch (config.provider) {
    case 'openai': return openaiGenerateTest(config, onRetry, onUsage)
    case 'anthropic': return anthropicGenerateTest(config, onRetry, onUsage)
    default: return geminiGenerateTest(config, onRetry, onUsage, onLog)
  }
}

export async function auditTest(
  subject: string,
  assessment: Assessment,
  model: string,
  provider: GenerationConfig['provider'],
  apiKey?: string,
  onUsage?: UsageCallback
): Promise<QuestionItem[]> {
  switch (provider) {
    case 'openai': return openaiAuditTest(subject, assessment, model, apiKey, onUsage)
    case 'anthropic': return anthropicAuditTest(subject, assessment, model, apiKey, onUsage)
    default: return geminiAuditTest(subject, assessment, model, apiKey, onUsage)
  }
}

export async function getStudentFeedback(
  subject: string,
  assessment: Assessment,
  studentAnswers: string[],
  model: string,
  provider: GenerationConfig['provider'],
  apiKey?: string
): Promise<string> {
  switch (provider) {
    case 'openai': return openaiGetStudentFeedback(subject, assessment, studentAnswers, model, apiKey)
    case 'anthropic': return anthropicGetStudentFeedback(subject, assessment, studentAnswers, model, apiKey)
    default: return geminiGetStudentFeedback(subject, assessment, studentAnswers, model, apiKey)
  }
}

export async function checkPracticeAnswer(
  subject: string,
  question: QuestionItem,
  userAnswer: string,
  model: string,
  provider: GenerationConfig['provider'],
  apiKey?: string,
): Promise<Omit<PracticeAnswerRecord, 'userAnswer'>> {
  const prompt = `You are a Cambridge IGCSE examiner for ${subject}.

QUESTION (${question.marks} mark${question.marks !== 1 ? 's' : ''}, command word: ${question.commandWord}):
${question.text}

OFFICIAL MARK SCHEME:
${question.markScheme}

STUDENT ANSWER:
${userAnswer}

TASK: Evaluate the student's answer strictly against the mark scheme.
Respond with valid JSON ONLY — no markdown, no explanation outside the JSON:
{
  "isCorrect": boolean,
  "marksAwarded": number,
  "feedback": "string (1-3 sentences: what was right, what was missing, how to improve)"
}

Rules:
- Award marks for each mark-scheme point the student has addressed.
- Ignore spelling errors for scientific terms if the meaning is clear.
- Be strict about command words: "State" needs a bare fact; "Explain" needs a mechanism; "Calculate" needs a numerical answer with correct units.
- marksAwarded must be an integer between 0 and ${question.marks}.
- isCorrect is true only if full marks are awarded.`

  const fallback: Omit<PracticeAnswerRecord, 'userAnswer'> = {
    isCorrect: false,
    marksAwarded: 0,
    aiFeedback: 'Could not evaluate answer. Please check your API key and try again.',
  }

  try {
    let rawText = ''

    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 512,
          response_format: { type: 'json_object' },
        }),
      })
      if (!res.ok) throw new Error(`OpenAI error ${res.status}`)
      const data = await res.json()
      rawText = data.choices[0].message.content as string
    } else if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey ?? '',
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!res.ok) throw new Error(`Anthropic error ${res.status}`)
      const data = await res.json()
      rawText = data.content[0].text as string
    } else {
      // Gemini
      const { GoogleGenAI } = await import('@google/genai')
      const ai = new GoogleGenAI({ apiKey: apiKey ?? '' })
      const result = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json', maxOutputTokens: 512 },
      })
      rawText = result.text ?? ''
    }

    const parsed = parseJsonWithRecovery(rawText)
    if (!parsed || typeof parsed !== 'object') return fallback
    const p = parsed as Record<string, unknown>
    const marksAwarded = Math.min(question.marks, Math.max(0, Math.round(Number(p.marksAwarded ?? 0))))
    return {
      isCorrect: Boolean(p.isCorrect),
      marksAwarded,
      aiFeedback: typeof p.feedback === 'string' ? p.feedback : undefined,
    }
  } catch (err) {
    console.error('checkPracticeAnswer error:', err)
    return fallback
  }
}

export async function analyzeFile(
  base64Data: string,
  mimeType: string,
  subject: string,
  count: number,
  model: string,
  provider: GenerationConfig['provider'],
  references?: Reference[],
  apiKey?: string
): Promise<AnalyzeFileResult> {
  switch (provider) {
    case 'openai': return openaiAnalyzeFile(base64Data, mimeType, subject, count, model, references, apiKey)
    case 'anthropic': return anthropicAnalyzeFile(base64Data, mimeType, subject, count, model, references, apiKey)
    default: return geminiAnalyzeFile(base64Data, mimeType, subject, count, model, references, apiKey)
  }
}
