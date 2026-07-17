import { describe, expect, it, vi } from 'vitest'
import { zodTextFormat } from 'openai/helpers/zod'

import type { AnalyzeRecordingInput } from '../shared/analysis-contracts.js'
import { workflowAnalysisSchema } from '../shared/analysis-schema.js'
import { analyzeRecording, buildAnalysisContent } from './analysis.js'
import { TEST_WORKFLOW_ANALYSIS } from './analysis-fixture.js'

const input: AnalyzeRecordingInput = {
  recordingId: '9d9ca2de-0bc1-45eb-977e-9c9bcba8a77d',
  durationMs: 5_000,
  userIntent: 'Organize new assets using the same structure I demonstrated.',
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

  it('accepts only immediate child-folder names in learned rules', () => {
    for (const destinationFolder of ['.', '..', 'nested/folder', 'nested\\folder']) {
      const invalid = structuredClone(TEST_WORKFLOW_ANALYSIS)
      invalid.learnedWorkflow.fileOrganization!.rules[0].destinationFolder = destinationFolder
      expect(workflowAnalysisSchema.safeParse(invalid).success).toBe(false)
    }

    for (const destinationFolder of ['Projects', '.archive', '...']) {
      const valid = structuredClone(TEST_WORKFLOW_ANALYSIS)
      valid.learnedWorkflow.fileOrganization!.rules[0].destinationFolder = destinationFolder
      expect(workflowAnalysisSchema.safeParse(valid).success).toBe(true)
    }
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

  it('preserves a general learned workflow without forcing follow-up fields', async () => {
    const provider = vi.fn().mockResolvedValue(TEST_WORKFLOW_ANALYSIS)
    const result = await analyzeRecording(input, provider)

    expect(provider).toHaveBeenCalledOnce()
    expect(result.learnedWorkflow.capability).toBe('organize_files')
    expect(result.learnedWorkflow.steps).toHaveLength(3)
  })

  it('represents workflows outside the current executor honestly', async () => {
    const unsupportedAnalysis = {
      ...TEST_WORKFLOW_ANALYSIS,
      title: 'Prepare a weekly report',
      summary: 'The recording shows rows being reviewed before a report is submitted.',
      goalHypothesis: 'Review the report and submit it after approval.',
      learnedWorkflow: {
        capability: 'not_yet_supported' as const,
        summary: 'Review report rows and submit the completed report.',
        steps: [
          { label: 'Review rows', description: 'Check the report data for completeness.' },
          { label: 'Submit report', description: 'Send the completed report for review.' }
        ],
        fileOrganization: null
      }
    }

    const result = await analyzeRecording(input, async () => unsupportedAnalysis)

    expect(result.learnedWorkflow).toMatchObject({
      capability: 'not_yet_supported',
      fileOrganization: null
    })
  })

  it('allows a complete analysis without an interview', async () => {
    const completeAnalysis = {
      ...TEST_WORKFLOW_ANALYSIS,
      title: 'Prepare a weekly report',
      summary: 'The recording shows a completed report being reviewed.',
      goalHypothesis: 'Review the completed report.'
    }

    await expect(analyzeRecording(input, async () => completeAnalysis)).resolves.toMatchObject({
      goalHypothesis: 'Review the completed report.'
    })
  })

  it('preserves dynamically learned asset groups', async () => {
    const result = await analyzeRecording(input, async () => TEST_WORKFLOW_ANALYSIS)

    expect(result.learnedWorkflow.fileOrganization?.rules.map((rule) => rule.label)).toEqual([
      'Project footage',
      'Visual assets',
      'Project packages'
    ])
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
