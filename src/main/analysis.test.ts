import { describe, expect, it, vi } from 'vitest'

import type { AnalyzeRecordingInput } from '../shared/analysis-contracts.js'
import { analyzeRecording, buildAnalysisContent } from './analysis.js'
import { TEST_WORKFLOW_ANALYSIS } from './analysis-fixture.js'

const input: AnalyzeRecordingInput = {
  recordingId: '9d9ca2de-0bc1-45eb-977e-9c9bcba8a77d',
  durationMs: 5_000,
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
  it('labels frame evidence in the multimodal request', () => {
    const content = buildAnalysisContent(input)
    expect(content).toHaveLength(3)
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

  it('rejects output that omits the intent interview', async () => {
    await expect(
      analyzeRecording(input, async () => ({ ...TEST_WORKFLOW_ANALYSIS, followUpQuestions: [] }))
    ).rejects.toThrow()
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
