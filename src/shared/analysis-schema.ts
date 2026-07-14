import { z } from 'zod'

import { recordingIdSchema } from './recording-schema.js'

export const extractedFrameSchema = z.object({
  timestampMs: z.number().int().nonnegative().max(3_600_000),
  dataUrl: z
    .string()
    .max(2_000_000)
    .regex(/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+=*$/),
  width: z.number().int().positive().max(1280),
  height: z.number().int().positive().max(1280)
})

export const analyzeRecordingInputSchema = z.object({
  recordingId: recordingIdSchema,
  durationMs: z.number().int().min(100).max(3_600_000),
  frames: z.array(extractedFrameSchema).min(1).max(8)
})

export const workflowAnalysisSchema = z.object({
  title: z.string().min(1).max(80),
  summary: z.string().min(1).max(600),
  goalHypothesis: z.string().min(1).max(400),
  observedSteps: z
    .array(
      z.object({
        order: z.number().int().positive(),
        action: z.string().min(1).max(240),
        target: z.string().min(1).max(160),
        evidenceFrameIndexes: z.array(z.number().int().nonnegative()).max(8)
      })
    )
    .max(12),
  variables: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        currentValue: z.string().min(1).max(240),
        source: z.enum(['observed', 'inferred']),
        reason: z.string().min(1).max(240)
      })
    )
    .max(12),
  uncertainties: z.array(z.string().min(1).max(240)).max(8),
  followUpQuestions: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
        prompt: z.string().min(1).max(240),
        reason: z.string().min(1).max(240),
        answerType: z.enum(['text', 'single_choice', 'boolean']),
        options: z.array(z.string().min(1).max(100)).max(6)
      })
    )
    .min(2)
    .max(5),
  risks: z.array(z.string().min(1).max(240)).max(8)
})

export type WorkflowAnalysis = z.infer<typeof workflowAnalysisSchema>
