import { useState, useCallback } from 'react'
import type { Assessment, QuestionItem, AnalyzeFileResult, GenerationConfig, AIError, Resource } from '../lib/types'
import type { AIProvider } from '../lib/providers'
import type { NotifyFn } from './useNotifications'
import { generateTest, auditTest, getStudentFeedback as aiFeedback, analyzeFile as aiAnalyze } from '../lib/ai'
import { Timestamp } from 'firebase/firestore'
import { auth } from '../lib/firebase'

export function useGeneration(notify: NotifyFn, provider: AIProvider = 'gemini', apiKey?: string) {
  const [generatedAssessment, setGeneratedAssessment] = useState<Assessment | null>(null)
  const [analysisText, setAnalysisText] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAuditing, setIsAuditing] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [error, setError] = useState<AIError | null>(null)

  const generate = useCallback(async (
    config: GenerationConfig,
    knowledgeBaseResources: Resource[],
    getBase64: (r: Resource) => Promise<string>
  ) => {
    setIsGenerating(true)
    setRetryCount(0)
    setError(null)
    try {
      const references = await Promise.all(
        knowledgeBaseResources.map(async r => ({
          data: await getBase64(r),
          mimeType: r.mimeType,
        }))
      )
      const questions = await generateTest({ ...config, references, apiKey }, (attempt) => {
        setRetryCount(attempt)
        notify(`Rate limit hit, retrying (${attempt}/3)...`, 'info')
      })
      setIsAuditing(true)
      notify('Auditing assessment quality...', 'info')
      await new Promise(r => setTimeout(r, 3000))
      const draft: Assessment = {
        id: crypto.randomUUID(),
        subject: config.subject,
        topic: config.topic,
        difficulty: config.difficulty,
        questions,
        userId: auth.currentUser?.uid ?? '',
        createdAt: Timestamp.now(),
      }
      const auditedQuestions = await auditTest(config.subject, draft, config.model, config.provider, apiKey)
      setGeneratedAssessment({ ...draft, questions: auditedQuestions })
      notify('Assessment generated successfully!', 'success')
    } catch (e: any) {
      const ae = e as AIError
      setError(ae)
      notify(ae.message ?? 'Failed to generate assessment', 'error')
    } finally {
      setIsGenerating(false)
      setIsAuditing(false)
    }
  }, [notify, provider, apiKey])

  const analyzeFile = useCallback(async (
    file: { base64: string; mimeType: string },
    subject: string,
    model: string,
    knowledgeBaseResources: Resource[],
    getBase64: (r: Resource) => Promise<string>
  ) => {
    setIsGenerating(true)
    setError(null)
    try {
      const references = await Promise.all(
        knowledgeBaseResources.map(async r => ({
          data: await getBase64(r),
          mimeType: r.mimeType,
        }))
      )
      const result: AnalyzeFileResult = await aiAnalyze(
        file.base64,
        file.mimeType,
        subject,
        3,
        model,
        provider,
        references,
        apiKey
      )
      setAnalysisText(result.analysis)
      setGeneratedAssessment({
        id: crypto.randomUUID(),
        subject,
        topic: 'Analyzed Content',
        difficulty: 'N/A',
        questions: result.questions,
        userId: auth.currentUser?.uid ?? '',
        createdAt: Timestamp.now(),
      })
      notify('File analyzed successfully!', 'success')
    } catch (e: any) {
      const ae = e as AIError
      setError(ae)
      notify(ae.message ?? 'Failed to analyze file', 'error')
    } finally {
      setIsGenerating(false)
    }
  }, [notify, provider, apiKey])

  const getStudentFeedback = useCallback(async (
    studentAnswers: string[],
    model: string
  ) => {
    if (!generatedAssessment) return
    try {
      const fb = await aiFeedback(
        generatedAssessment.subject,
        generatedAssessment,
        studentAnswers,
        model,
        provider,
        apiKey
      )
      notify('Feedback ready', 'success')
      return fb
    } catch {
      notify('Failed to get feedback', 'error')
      return null
    }
  }, [generatedAssessment, notify, provider, apiKey])

  return {
    generatedAssessment,
    setGeneratedAssessment,
    analysisText,
    isGenerating,
    isAuditing,
    retryCount,
    error,
    setError,
    generate,
    analyzeFile,
    getStudentFeedback,
  }
}
