import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
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
    await expect(page.getByRole('heading', { name: 'Choose what to record' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Share entire screen: Entire screen' })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Share window: Downloads - Finder' })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Share window: Creator dashboard - Browser' })
    ).toBeVisible()
    await page.locator('.recorder').screenshot({ path: 'output/playwright/source-picker.png' })
    await page.getByRole('button', { name: 'Share window: Downloads - Finder' }).click()
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
    await expect(page.getByRole('heading', { name: 'A few quick questions' })).toBeVisible()
    await expect(page.getByText('Goal', { exact: true })).toBeVisible()
    const visibleInterviewText = await page.locator('.intent-interview').innerText()
    expect(visibleInterviewText).not.toContain('—')
    expect(visibleInterviewText).not.toContain('source_folder')

    await page.setViewportSize({ width: 900, height: 620 })
    const workspace = page.locator('.workspace')
    const scrollMetrics = await workspace.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight
    }))
    expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight)
    await workspace.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
    await expect(page.getByRole('button', { name: 'Save and review' })).toBeInViewport()

    await page
      .getByLabel('Where should TaskTape look for new videos and images?')
      .fill('/Users/test/Downloads')
    await page
      .getByLabel('How do you decide which folder each file belongs in?')
      .fill('Group files by project, then by media type.')
    await page
      .getByLabel('What folder structure should TaskTape create or reuse?')
      .fill('Project / Raw Video / Images / Exports')
    await page
      .getByLabel('Should TaskTape move the original files or keep a copy?')
      .selectOption('Copy and keep the originals')
    await page
      .getByLabel('What should happen when a file does not match any category?')
      .selectOption('Put it in an Unsorted folder')
    await page
      .getByTestId('recording-preview')
      .evaluate((video: HTMLVideoElement) => (video.style.visibility = 'hidden'))
    await page
      .locator('.recorder-copy')
      .screenshot({ path: 'output/playwright/intent-interview.png' })
    await page.getByRole('button', { name: 'Save and review' }).click()

    await expect(page.getByRole('heading', { name: 'Review the workflow' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Review the workflow' })).toBeFocused()
    await expect(page.getByText('Answers saved', { exact: true })).toBeVisible()
    await expect(page.getByText('Ready for a dry run', { exact: true })).toBeVisible()
    await expect(page.getByText('No files have changed.', { exact: false })).toBeVisible()
    await expect(page.getByText('Group files by project, then by media type.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save and review' })).toHaveCount(0)
    const visibleDraftText = await page.locator('.workflow-draft').innerText()
    expect(visibleDraftText).not.toContain('—')
    expect(visibleDraftText).not.toContain('category_rules')
    await page.screenshot({ path: 'output/playwright/workflow-draft-review.png' })

    await page.getByRole('button', { name: 'Edit answers' }).click()
    await expect(page.getByRole('heading', { name: 'A few quick questions' })).toBeVisible()
    await expect(
      page.getByLabel('How do you decide which folder each file belongs in?')
    ).toHaveValue('Group files by project, then by media type.')
    await page
      .getByTestId('recording-preview')
      .evaluate((video: HTMLVideoElement) => (video.style.visibility = ''))
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
    await page.getByRole('button', { name: 'Share entire screen: Entire screen' }).click()
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

test('cancels the source chooser without starting capture', async () => {
  const { application, userData } = await launchTestApp()

  try {
    const page = await application.firstWindow()
    await page.getByRole('button', { name: 'Start recording' }).click()
    await expect(page.getByRole('heading', { name: 'Choose what to record' })).toBeVisible()
    await page.getByRole('button', { name: 'Refresh open windows' }).click()
    await expect(
      page.getByRole('button', { name: 'Share entire screen: Entire screen' })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible()
    await expect(readdir(join(userData, 'recordings'))).rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    await application.close()
    await rm(userData, { recursive: true, force: true })
  }
})

test('stores and clears an app-managed API key without exposing plaintext', async () => {
  const { application, userData } = await launchTestApp()
  const fakeApiKey = `sk-proj-${'e2e'.repeat(30)}`

  try {
    const page = await application.firstWindow()
    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'OpenAI connection' })).toBeVisible()

    await page.getByLabel('OpenAI API key').fill(fakeApiKey)
    await page.getByRole('button', { name: 'Save key' }).click()
    await expect(page.getByText('App key configured')).toBeVisible()
    await expect(page.getByLabel('OpenAI API key')).toHaveValue('')

    const stored = await readFile(join(userData, 'settings', 'credentials.json'), 'utf8')
    expect(stored).not.toContain(fakeApiKey)
    await page.screenshot({ path: 'output/playwright/api-key-settings.png' })

    await page.getByRole('button', { name: 'Remove app key' }).click()
    await expect(page.getByText('The app-managed key was removed.')).toBeVisible()
    await expect(readFile(join(userData, 'settings', 'credentials.json'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  } finally {
    await application.close()
    await rm(userData, { recursive: true, force: true })
  }
})
