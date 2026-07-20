import { mkdir } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

const downloadUrl =
  'https://github.com/codeswithroh/tasktape/releases/latest/download/TaskTape-latest-arm64.dmg'

test('presents the portable replay workflow without layout errors', async ({ page }, testInfo) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'TaskTape Replay' })).toBeVisible()
  await expect(page.getByText('Report, evidence, and Playwright code')).toBeVisible()
  await expect(page.getByText('Portable test', { exact: true })).toBeVisible()
  await page.locator('.proof-product').scrollIntoViewIfNeeded()
  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0)
  )

  const downloadLinks = page.locator('a.button-download')
  await expect(downloadLinks).toHaveCount(3)
  for (let index = 0; index < (await downloadLinks.count()); index += 1) {
    await expect(downloadLinks.nth(index)).toHaveAttribute('href', downloadUrl)
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  )
  expect(overflow).toBe(false)
  expect(consoleErrors).toEqual([])

  await mkdir('output/playwright', { recursive: true })
  await page.screenshot({
    path: `output/playwright/landing-${testInfo.project.name}.png`,
    fullPage: true
  })
})
