import { z } from 'zod'

import {
  MAX_TRANSCRIPTION_AUDIO_BYTES,
  TRANSCRIBABLE_AUDIO_MIME_TYPES
} from './analysis-contracts.js'
import { recordingIdSchema } from './recording-schema.js'

export const transcribeIntentInputSchema = z.object({
  data: z
    .instanceof(ArrayBuffer)
    .refine((data) => data.byteLength > 0, 'Audio cannot be empty.')
    .refine(
      (data) => data.byteLength <= MAX_TRANSCRIPTION_AUDIO_BYTES,
      'Audio must be 25 MB or smaller.'
    ),
  mimeType: z.enum(TRANSCRIBABLE_AUDIO_MIME_TYPES)
})

export const intentTranscriptSchema = z.string().trim().min(1).max(10_000)

export const transcribeIntentResultSchema = z.object({
  text: intentTranscriptSchema
})

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
  frames: z.array(extractedFrameSchema).min(1).max(8),
  userIntent: intentTranscriptSchema
})

const proposedChildDirectorySchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^(?:[^./\\]|[^./\\][^/\\]+|\.[^./\\][^/\\]*|\.\.[^/\\][^/\\]*)$/)

export const learnedWorkflowProposalSchema = z.object({
  capability: z.enum(['organize_files', 'computer']),
  summary: z.string().min(1).max(180),
  steps: z
    .array(
      z.object({
        label: z.string().min(1).max(80),
        description: z.string().min(1).max(180)
      })
    )
    .min(1)
    .max(8),
  fileOrganization: z
    .object({
      sourceHint: z.string().min(1).max(120).nullable(),
      operation: z.enum(['move', 'copy']),
      rules: z
        .array(
          z.object({
            id: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
            label: z.string().min(1).max(80),
            extensions: z
              .array(z.string().regex(/^\.[a-z0-9]{1,10}$/))
              .min(1)
              .max(24),
            destinationFolder: proposedChildDirectorySchema
          })
        )
        .min(1)
        .max(20),
      unmatchedPolicy: z.enum(['leave', 'move']),
      unmatchedFolder: proposedChildDirectorySchema.nullable()
    })
    .nullable(),
  computerAutomation: z
    .object({
      instructions: z.string().min(1).max(2_000),
      targetApp: z.string().min(1).max(120).nullable(),
      expectedOutcome: z.string().min(1).max(500).nullable()
    })
    .nullable()
})

export const scheduleProposalSchema = z.object({
  frequency: z.enum(['manual', 'hourly', 'daily', 'weekdays', 'weekly']),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  weekday: z.number().int().min(0).max(6).nullable()
})

export const workflowAnalysisSchema = z.object({
  title: z.string().min(1).max(60),
  summary: z.string().min(1).max(240),
  goalHypothesis: z.string().min(1).max(180),
  observedSteps: z
    .array(
      z.object({
        order: z.number().int().positive(),
        action: z.string().min(1).max(180),
        target: z.string().min(1).max(120),
        evidenceFrameIndexes: z.array(z.number().int().nonnegative()).max(8)
      })
    )
    .max(12),
  variables: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        currentValue: z.string().min(1).max(180),
        source: z.enum(['observed', 'inferred']),
        reason: z.string().min(1).max(160)
      })
    )
    .max(12),
  uncertainties: z.array(z.string().min(1).max(180)).max(8),
  learnedWorkflow: learnedWorkflowProposalSchema,
  scheduleProposal: scheduleProposalSchema.nullable(),
  risks: z.array(z.string().min(1).max(180)).max(8)
})

type ParsedWorkflowAnalysis = z.infer<typeof workflowAnalysisSchema>

export type WorkflowAnalysis = Omit<ParsedWorkflowAnalysis, 'scheduleProposal'> & {
  scheduleProposal?: ParsedWorkflowAnalysis['scheduleProposal']
}
