import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

async function launchTestApp(): Promise<{
  application: Awaited<ReturnType<typeof electron.launch>>
  userData: string
}> {
  const userData = await mkdtemp(join(tmpdir(), 'tasktape-e2e-'))
  const application = await electron.launch({
    args: [resolve('.')],
    env: {
      ...process.env,
      TASKTAPE_E2E: '1',
      TASKTAPE_USER_DATA: userData
    }
  })
  return { application, userData }
}

test('launches the isolated TaskTape shell', async () => {
  const { application, userData } = await launchTestApp()

  try {
    const page = await application.firstWindow()
    await expect(page).toHaveTitle('TaskTape')
    await expect(page.getByRole('heading', { name: 'Teach TaskTape a routine' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible()

    const bridge = await page.evaluate(() => window.tasktape.appInfo)
    expect(bridge).toMatchObject({ name: 'TaskTape', version: '0.1.0', platform: 'darwin' })
    expect(await page.evaluate(() => window.tasktape.testMode)).toBe(true)
    expect(await page.evaluate(() => 'process' in window)).toBe(false)

    await page.addStyleTag({
      content: '*, *::before, *::after { animation: none !important; transition: none !important; }'
    })
    await page.screenshot({ path: 'output/playwright/foundation-shell.png' })
  } finally {
    await application.close()
    await rm(userData, { recursive: true, force: true })
  }
})

test('records, saves, previews, and discards a workflow', async () => {
  const { application, userData } = await launchTestApp()

  try {
    const page = await application.firstWindow()
    await page.getByRole('button', { name: 'Start recording' }).click()
    await expect(page.getByRole('button', { name: 'Stop and save' })).toBeVisible()
    await page.waitForTimeout(650)
    await page.getByRole('button', { name: 'Stop and save' }).click()

    await expect(page.getByRole('heading', { name: 'Ready to explain' })).toBeVisible()
    await expect(page.getByTestId('recording-preview')).toBeVisible()
    await expect(page.getByTestId('frame-count')).toHaveText('1')
    const extractedFrame = page.getByTestId('key-frame')
    await expect(extractedFrame).toBeVisible()
    expect(await extractedFrame.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(
      1280
    )
    expect(await extractedFrame.getAttribute('src')).toMatch(/^data:image\/jpeg;base64,/)
    expect(await readdir(join(userData, 'recordings'))).toHaveLength(2)

    await page.getByRole('button', { name: 'Explain this workflow' }).click()
    await expect(page.getByRole('heading', { name: 'Clarify the intent' })).toBeVisible()
    await expect(page.getByText('Inferred goal', { exact: true })).toBeVisible()
    await page.getByLabel('1. Which folder should this workflow inspect?').fill('/tmp/inbox')
    await page
      .getByLabel(
        '2. What should happen when a destination already contains a file with the same name?'
      )
      .selectOption('Skip and report it')
    await page.getByRole('button', { name: 'Confirm intent' }).click()
    await expect(page.getByRole('button', { name: 'Intent confirmed' })).toBeDisabled()
    await page.locator('.recorder').screenshot({ path: 'output/playwright/intent-interview.png' })
    await page.getByRole('button', { name: 'Back to recording' }).click()

    await page.addStyleTag({
      content: '*, *::before, *::after { animation: none !important; transition: none !important; }'
    })
    await page.locator('.recorder').screenshot({ path: 'output/playwright/recording-ready.png' })

    await page.getByRole('button', { name: 'Discard' }).click()
    await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible()
    expect(await readdir(join(userData, 'recordings'))).toHaveLength(0)
  } finally {
    await application.close()
    await rm(userData, { recursive: true, force: true })
  }
})

test('cancels without persisting a recording', async () => {
  const { application, userData } = await launchTestApp()

  try {
    const page = await application.firstWindow()
    await page.getByRole('button', { name: 'Start recording' }).click()
    await expect(page.getByRole('button', { name: 'Cancel recording' })).toBeVisible()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Cancel recording' }).click()
    await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible()
    await expect(readdir(join(userData, 'recordings'))).rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    await application.close()
    await rm(userData, { recursive: true, force: true })
  }
})
