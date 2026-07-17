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
Separate observed values from inferred values. Record unresolved details as uncertainties instead of turning every
inference into a form field. Learn reusable rules from the demonstration instead of asking the user to confirm one
observed filename or manually restate every demonstrated destination.
Always return learnedWorkflow as a general description of what was taught. Use capability organize_files only when
the workflow can be executed by inspecting top-level files in one folder, matching file extensions, and moving or
copying them into learned child folders. For that capability, infer reusable rules from the visible assets, folder
names, and the user's stated intent. Each rule must include a human label, the matching extensions, and one immediate
child-folder name without a slash. Infer sourceHint from a visible folder such as Downloads when possible. Do not
force video and image categories; return whichever asset groups the demonstration supports. Set fileOrganization to
null and capability to not_yet_supported when the workflow needs another application or capability. Never pretend an
unsupported workflow can run.
If the user states a run frequency or time, represent it in scheduleProposal. Weekdays use 0 for Sunday through 6
for Saturday and times use local 24-hour HH:MM format. Use manual when the user explicitly wants on-demand runs. Set
scheduleProposal to null when no schedule is stated. Never infer a schedule from the recording alone.
Write in natural, everyday language. Keep the summary to one sentence of at most 20 words and the goal to at most
18 words. Keep each step short; include exact file or folder names only when needed. Keep each reason to one
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
          scheduleProposal:
            'scheduleProposal' in providerOutput ? providerOutput.scheduleProposal : null
        }
      : providerOutput
  const analysis = workflowAnalysisSchema.parse(compatibleOutput)
  const learned = analysis.learnedWorkflow
  if (learned.capability === 'organize_files' && !learned.fileOrganization) {
    throw new Error('The analysis did not include the learned file rules.')
  }
  if (learned.capability === 'not_yet_supported' && learned.fileOrganization) {
    throw new Error('An unsupported workflow cannot include executable file rules.')
  }
  if (learned.fileOrganization) {
    const extensions = learned.fileOrganization.rules.flatMap((rule) => rule.extensions)
    if (new Set(extensions).size !== extensions.length) {
      throw new Error('The analysis assigned one file type to more than one learned rule.')
    }
    if (
      learned.fileOrganization.unmatchedPolicy === 'move' &&
      !learned.fileOrganization.unmatchedFolder
    ) {
      throw new Error('The analysis did not include a destination for unmatched files.')
    }
  }
  const invalidEvidence = analysis.observedSteps.some((step) =>
    step.evidenceFrameIndexes.some((index) => index >= input.frames.length)
  )
  if (invalidEvidence) throw new Error('Analysis cited a frame that was not provided.')
  return analysis
}
