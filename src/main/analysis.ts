import OpenAI, { toFile } from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import type { ResponseInputContent } from 'openai/resources/responses/responses'

import type {
  AnalyzeRecordingInput,
  TranscribeIntentInput,
  TranscribableAudioMimeType
} from '../shared/analysis-contracts.js'
import {
  analyzeRecordingInputSchema,
  intentTranscriptSchema,
  transcribeIntentInputSchema,
  transcribeIntentResultSchema,
  type WorkflowAnalysis,
  workflowAnalysisSchema
} from '../shared/analysis-schema.js'
import { planIntentInterview } from './interview-planner.js'

type AnalysisProvider = (input: AnalyzeRecordingInput) => Promise<unknown>
type ValidatedTranscribeIntentInput = ReturnType<typeof transcribeIntentInputSchema.parse>
type TranscriptionProvider = (input: ValidatedTranscribeIntentInput) => Promise<unknown>

export const TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe'

const AUDIO_FILE_EXTENSIONS: Record<TranscribableAudioMimeType, string> = {
  'audio/flac': 'flac',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'audio/webm;codecs=opus': 'webm',
  'audio/x-wav': 'wav'
}

const ANALYSIS_INSTRUCTIONS = `You analyze a sparse sequence of frames sampled from a user's screen recording.
The user's transcribed statement of intent is the primary description of their desired outcome. Give it prominent
weight when identifying the goal and proposing a workflow, while using the frames to ground observed steps and flag
any conflict or unsupported detail instead of silently inventing evidence.
Describe only what the frames support. Never claim that an action occurred between frames unless it is visible.
Separate observed values from inferred values. Ask zero to five high-value follow-up questions that resolve intent,
scope, safety boundaries, variable inputs, and ambiguous outcomes. Learn reusable rules from the demonstration instead
of asking the user to confirm one observed filename. For media organization workflows, ask where new media comes from,
how files are categorized, which folder structure to follow, whether to move or copy files, and how to handle files
that do not match a category.
For a media organization workflow, propose mediaRecipe with concrete video and image destination folders, move or
copy behavior, and whether unmatched files stay in place or move to an unmatched folder. Otherwise set mediaRecipe
to null.
If the user states a run frequency or time, represent it in scheduleProposal. Weekdays use 0 for Sunday through 6
for Saturday and times use local 24-hour HH:MM format. Use manual when the user explicitly wants on-demand runs. Set
scheduleProposal to null when no schedule is stated. Never infer a schedule from the recording alone.
Write in natural, everyday language. Keep the summary to one sentence of at most 20 words and the goal to at most
18 words. Keep each question short; include exact file or folder names only when needed. Keep each reason to one
brief sentence. Do not use em dashes, internal IDs, jargon, or snake case unless it is part of an exact filename.
Do not generate executable code or claim that an automation is ready.`

export function buildAnalysisContent(input: AnalyzeRecordingInput): ResponseInputContent[] {
  const content: ResponseInputContent[] = [
    {
      type: 'input_text',
      text: `USER-STATED INTENT:\n${input.userIntent}\n\nAnalyze recording ${input.recordingId}. Its measured duration is ${input.durationMs} ms. Frame indexes are zero-based and must be used as evidence.`
    }
  ]

  input.frames.forEach((frame, index) => {
    content.push({
      type: 'input_text',
      text: `Frame ${index}, sampled at ${frame.timestampMs} ms:`
    })
    content.push({
      type: 'input_image',
      detail: 'low',
      image_url: frame.dataUrl
    })
  })

  return content
}

export async function requestOpenAITranscription(
  input: TranscribeIntentInput,
  configuredApiKey = process.env.OPENAI_API_KEY
): Promise<string> {
  if (!configuredApiKey) throw new Error('An OpenAI API key is not configured for TaskTape.')

  const validatedInput = transcribeIntentInputSchema.parse(input)
  const client = new OpenAI({ apiKey: configuredApiKey })
  const file = await toFile(
    new Uint8Array(validatedInput.data),
    `tasktape-intent.${AUDIO_FILE_EXTENSIONS[validatedInput.mimeType]}`,
    { type: validatedInput.mimeType }
  )
  const transcription = await client.audio.transcriptions.create({
    file,
    model: TRANSCRIPTION_MODEL,
    response_format: 'json'
  })
  return intentTranscriptSchema.parse(transcription.text)
}

export async function transcribeIntent(
  rawInput: TranscribeIntentInput,
  provider: TranscriptionProvider = requestOpenAITranscription
): Promise<{ text: string }> {
  const input = transcribeIntentInputSchema.parse(rawInput)
  return transcribeIntentResultSchema.parse({ text: await provider(input) })
}

export async function requestOpenAIAnalysis(
  input: AnalyzeRecordingInput,
  configuredApiKey = process.env.OPENAI_API_KEY
): Promise<WorkflowAnalysis> {
  if (!configuredApiKey) throw new Error('An OpenAI API key is not configured for TaskTape.')

  const client = new OpenAI({ apiKey: configuredApiKey })
  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL || 'gpt-5.6',
    instructions: ANALYSIS_INSTRUCTIONS,
    input: [{ role: 'user', content: buildAnalysisContent(input) }],
    text: { format: zodTextFormat(workflowAnalysisSchema, 'tasktape_workflow_analysis') },
    store: false
  })

  if (!response.output_parsed) throw new Error('OpenAI returned no structured workflow analysis.')
  return response.output_parsed
}

export async function analyzeRecording(
  rawInput: AnalyzeRecordingInput,
  provider: AnalysisProvider = requestOpenAIAnalysis
): Promise<WorkflowAnalysis> {
  const input = analyzeRecordingInputSchema.parse(rawInput)
  const providerOutput = await provider(input)
  const compatibleOutput =
    typeof providerOutput === 'object' && providerOutput !== null && !Array.isArray(providerOutput)
      ? {
          ...providerOutput,
          mediaRecipe: 'mediaRecipe' in providerOutput ? providerOutput.mediaRecipe : null,
          scheduleProposal:
            'scheduleProposal' in providerOutput ? providerOutput.scheduleProposal : null
        }
      : providerOutput
  const analysis = workflowAnalysisSchema.parse(compatibleOutput)
  const invalidEvidence = analysis.observedSteps.some((step) =>
    step.evidenceFrameIndexes.some((index) => index >= input.frames.length)
  )
  if (invalidEvidence) throw new Error('Analysis cited a frame that was not provided.')
  return workflowAnalysisSchema.parse(planIntentInterview(analysis))
}
