import { describe, expect, it, vi } from 'vitest'
import { zodTextFormat } from 'openai/helpers/zod'

import { evaluateComputerOutcome, outcomeEvaluationSchema } from './outcome-evaluator.js'

const input = {
  expectedOutcome: 'The saved item visibly has the Video category.',
  screenshotDataUrl: 'data:image/png;base64,c2NyZWVu'
}

describe('computer outcome evaluator', () => {
  it('converts the result contract to a strict OpenAI output schema', () => {
    expect(() => zodTextFormat(outcomeEvaluationSchema, 'tasktape_outcome')).not.toThrow()
  })

  it.each(['passed', 'failed', 'inconclusive'] as const)(
    'preserves a schema-bound %s result',
    async (status) => {
      const provider = vi.fn().mockResolvedValue({
        status,
        summary: `The check is ${status}.`,
        evidence: ['The category label is visible.']
      })

      await expect(evaluateComputerOutcome(input, provider)).resolves.toMatchObject({ status })
      expect(provider).toHaveBeenCalledWith(input)
    }
  )

  it('rejects an invalid screenshot boundary', async () => {
    await expect(
      evaluateComputerOutcome({ ...input, screenshotDataUrl: 'https://example.com/screen.png' })
    ).rejects.toThrow()
  })
})
