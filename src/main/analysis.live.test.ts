import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { config } from 'dotenv'
import { describe, expect, it } from 'vitest'

import type { AnalyzeRecordingInput } from '../shared/analysis-contracts.js'
import { requestOpenAIAnalysis } from './analysis.js'

config({ path: [resolve('.env.local'), resolve('.env')], quiet: true })

describe('live OpenAI recording analysis', () => {
  it('returns a schema-bound interview from a real TaskTape screenshot', async () => {
    const screenshot = await readFile(resolve('output/playwright/foundation-shell.png'))
    const input: AnalyzeRecordingInput = {
      recordingId: '9d9ca2de-0bc1-45eb-977e-9c9bcba8a77d',
      durationMs: 5_000,
      userIntent: 'Organize new videos and images into separate folders by media type.',
      frames: [
        {
          timestampMs: 2_500,
          dataUrl: `data:image/png;base64,${screenshot.toString('base64')}`,
          width: 1180,
          height: 760
        }
      ]
    }

    const analysis = await requestOpenAIAnalysis(input)
    expect(analysis.title.length).toBeGreaterThan(0)
    expect(analysis.followUpQuestions.every((question) => question.reason.length > 0)).toBe(true)
  })
})
