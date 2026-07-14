import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import type { ResponseInputContent } from 'openai/resources/responses/responses'

import type { AnalyzeRecordingInput } from '../shared/analysis-contracts.js'
import {
  analyzeRecordingInputSchema,
  type WorkflowAnalysis,
  workflowAnalysisSchema
} from '../shared/analysis-schema.js'
import { planIntentInterview } from './interview-planner.js'

type AnalysisProvider = (input: AnalyzeRecordingInput) => Promise<unknown>

const ANALYSIS_INSTRUCTIONS = `You analyze a sparse sequence of frames sampled from a user's screen recording.
Describe only what the frames support. Never claim that an action occurred between frames unless it is visible.
Separate observed values from inferred values. Ask two to five high-value follow-up questions that resolve intent,
scope, safety boundaries, variable inputs, and ambiguous outcomes. Learn reusable rules from the demonstration instead
of asking the user to confirm one observed filename. For media organization workflows, ask where new media comes from,
how files are categorized, which folder structure to follow, whether to move or copy files, and how to handle files
that do not match a category.
Write in natural, everyday language. Keep the summary to one sentence of at most 20 words and the goal to at most
18 words. Keep each question short; include exact file or folder names only when needed. Keep each reason to one
brief sentence. Do not use em dashes, internal IDs, jargon, or snake case unless it is part of an exact filename.
Do not generate executable code or claim that an automation is ready.`

export function buildAnalysisContent(input: AnalyzeRecordingInput): ResponseInputContent[] {
  const content: ResponseInputContent[] = [
    {
      type: 'input_text',
      text: `Analyze recording ${input.recordingId}. Its measured duration is ${input.durationMs} ms. Frame indexes are zero-based and must be used as evidence.`
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
  const analysis = workflowAnalysisSchema.parse(await provider(input))
  const invalidEvidence = analysis.observedSteps.some((step) =>
    step.evidenceFrameIndexes.some((index) => index >= input.frames.length)
  )
  if (invalidEvidence) throw new Error('Analysis cited a frame that was not provided.')
  return workflowAnalysisSchema.parse(planIntentInterview(analysis))
}
