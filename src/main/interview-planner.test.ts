import { describe, expect, it } from 'vitest'

import { TEST_WORKFLOW_ANALYSIS } from './analysis-fixture.js'
import { isMediaOrganizationWorkflow, planIntentInterview } from './interview-planner.js'

describe('intent interview planner', () => {
  it('recognizes a media organization workflow', () => {
    expect(isMediaOrganizationWorkflow(TEST_WORKFLOW_ANALYSIS)).toBe(true)
  })

  it('asks about reusable organization policy instead of observed filenames', () => {
    const planned = planIntentInterview(TEST_WORKFLOW_ANALYSIS)
    const prompts = planned.followUpQuestions.map((question) => question.prompt).join(' ')

    expect(prompts).toContain('videos and images')
    expect(prompts).toContain('folder structure')
    expect(prompts).toContain('does not match any category')
    expect(prompts).not.toMatch(/\.mp4\b/i)
  })
})
