import { _electron as electron, expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

test('launches the isolated TaskTape shell', async () => {
  const application = await electron.launch({ args: [resolve('.')] })

  try {
    const page = await application.firstWindow()
    await expect(page).toHaveTitle('TaskTape')
    await expect(page.getByRole('heading', { name: 'Teach TaskTape a routine' })).toBeVisible()
    const recorderButton = page.getByRole('button', { name: /Recorder coming in Milestone 1/ })
    await expect(recorderButton).toBeVisible()
    await expect(recorderButton).toBeDisabled()

    const bridge = await page.evaluate(() => window.tasktape.appInfo)
    expect(bridge).toMatchObject({ name: 'TaskTape', version: '0.1.0', platform: 'darwin' })

    const hasNodeGlobal = await page.evaluate(() => 'process' in window)
    expect(hasNodeGlobal).toBe(false)

    await page.waitForTimeout(600)
    await mkdir('output/playwright', { recursive: true })
    await page.screenshot({ path: 'output/playwright/foundation-shell.png' })
  } finally {
    await application.close()
  }
})
