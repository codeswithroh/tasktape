import { describe, expect, it, vi } from 'vitest'
import { zodTextFormat } from 'openai/helpers/zod'

import type { AnalyzeRecordingInput } from '../shared/analysis-contracts.js'
import { workflowAnalysisSchema } from '../shared/analysis-schema.js'
import { analyzeRecording, buildAnalysisContent } from './analysis.js'
import { TEST_WORKFLOW_ANALYSIS } from './analysis-fixture.js'

const input: AnalyzeRecordingInput = {
  recordingId: '9d9ca2de-0bc1-45eb-977e-9c9bcba8a77d',
  durationMs: 5_000,
  userIntent: 'Sort my videos and images into the right project folders.',
  frames: [
    {
      timestampMs: 2_500,
      dataUrl: `data:image/jpeg;base64,${Buffer.from('frame').toString('base64')}`,
      width: 1280,
      height: 720
    }
  ]
}

describe('recording analysis boundary', () => {
  it('converts the workflow contract to an OpenAI strict structured-output schema', () => {
    expect(() => zodTextFormat(workflowAnalysisSchema, 'tasktape_workflow_analysis')).not.toThrow()
  })

  it('labels frame evidence in the multimodal request', () => {
    const content = buildAnalysisContent(input)
    expect(content).toHaveLength(3)
    expect(content[0]).toMatchObject({
      type: 'input_text',
      text: expect.stringContaining(input.userIntent)
    })
    expect(content[1]).toMatchObject({
      type: 'input_text',
      text: expect.stringContaining('Frame 0')
    })
    expect(content[2]).toMatchObject({ type: 'input_image', detail: 'low' })
  })

  it('replaces file-specific questions with reusable media organization rules', async () => {
    const provider = vi.fn().mockResolvedValue(TEST_WORKFLOW_ANALYSIS)
    const result = await analyzeRecording(input, provider)

    expect(provider).toHaveBeenCalledOnce()
    expect(result.followUpQuestions).toHaveLength(5)
    expect(result.followUpQuestions.every((question) => question.reason.length > 20)).toBe(true)
    expect(result.followUpQuestions.map((question) => question.id)).toEqual([
      'media_source',
      'category_rules',
      'folder_structure',
      'file_action',
      'unmatched_media'
    ])
    expect(result.followUpQuestions.map((question) => question.prompt).join(' ')).not.toContain(
      'free_file_flip.mp4'
    )
  })

  it('preserves model questions for workflows outside media organization', async () => {
    const generalAnalysis = {
      ...TEST_WORKFLOW_ANALYSIS,
      title: 'Prepare a weekly report',
      summary: 'The recording shows rows being reviewed before a report is submitted.',
      goalHypothesis: 'Review the report and submit it after approval.'
    }

    const result = await analyzeRecording(input, async () => generalAnalysis)

    expect(result.followUpQuestions).toEqual(TEST_WORKFLOW_ANALYSIS.followUpQuestions)
  })

  it('allows a complete analysis to have no follow-up questions', async () => {
    const completeAnalysis = {
      ...TEST_WORKFLOW_ANALYSIS,
      title: 'Prepare a weekly report',
      summary: 'The recording shows a completed report being reviewed.',
      goalHypothesis: 'Review the completed report.',
      followUpQuestions: []
    }

    await expect(analyzeRecording(input, async () => completeAnalysis)).resolves.toMatchObject({
      followUpQuestions: []
    })
  })

  it('preserves a structured media recipe proposal', async () => {
    const mediaRecipe = {
      videoFolder: '/Media/Project/Video',
      imageFolder: '/Media/Project/Images',
      operation: 'copy' as const,
      unmatchedPolicy: 'leave' as const,
      unmatchedFolder: null
    }

    const result = await analyzeRecording(input, async () => ({
      ...TEST_WORKFLOW_ANALYSIS,
      mediaRecipe
    }))

    expect(result.mediaRecipe).toEqual(mediaRecipe)
  })

  it('preserves a schedule stated by the user', async () => {
    const scheduleProposal = { frequency: 'weekly' as const, time: '09:00', weekday: 1 }
    const result = await analyzeRecording(input, async () => ({
      ...TEST_WORKFLOW_ANALYSIS,
      scheduleProposal
    }))

    expect(result.scheduleProposal).toEqual(scheduleProposal)
  })

  it('rejects evidence indexes outside the submitted frame set', async () => {
    const invalidAnalysis = {
      ...TEST_WORKFLOW_ANALYSIS,
      observedSteps: [{ ...TEST_WORKFLOW_ANALYSIS.observedSteps[0], evidenceFrameIndexes: [1] }]
    }
    await expect(analyzeRecording(input, async () => invalidAnalysis)).rejects.toThrow(
      'Analysis cited a frame that was not provided.'
    )
  })
})
