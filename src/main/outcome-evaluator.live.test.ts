import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { describe, expect, it } from 'vitest'

import { requestOpenAIOutcomeEvaluation } from './outcome-evaluator.js'

config({ path: [resolve('.env.local'), resolve('.env')], quiet: true })

const expectedOutcome =
  'After Save, the item titled Launch clip appears in Saved assets with the category Video.'

async function screenshot(mode: 'broken' | 'fixed'): Promise<string> {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } })
    const html = (await readFile(resolve('tests/fixtures/replay-target.html'), 'utf8')).replace(
      '<body>',
      `<body data-mode="${mode}">`
    )
    await page.setContent(html)
    await page.getByRole('button', { name: 'Save asset' }).click()
    return `data:image/png;base64,${(await page.screenshot()).toString('base64')}`
  } finally {
    await browser.close()
  }
}

describe('live GPT-5.6 outcome evaluation', () => {
  it('distinguishes the same broken and fixed outcome five consecutive times', async () => {
    const [broken, fixed] = await Promise.all([screenshot('broken'), screenshot('fixed')])
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const [brokenResult, fixedResult] = await Promise.all([
        requestOpenAIOutcomeEvaluation({ expectedOutcome, screenshotDataUrl: broken }),
        requestOpenAIOutcomeEvaluation({ expectedOutcome, screenshotDataUrl: fixed })
      ])
      expect(brokenResult.status, `broken attempt ${attempt}`).toBe('failed')
      expect(fixedResult.status, `fixed attempt ${attempt}`).toBe('passed')
    }
  }, 180_000)
})
