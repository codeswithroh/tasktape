import { _electron as electron, expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

async function launchTestApp(environment: Record<string, string> = {}): Promise<{
  application: Awaited<ReturnType<typeof electron.launch>>
  userData: string
}> {
  const userData = await mkdtemp(join(tmpdir(), 'tasktape-e2e-'))
  const application = await electron.launch({
    args: [resolve('.')],
    env: {
      ...process.env,
      TASKTAPE_E2E: '1',
      TASKTAPE_USER_DATA: userData,
      ...environment
    }
  })
  return { application, userData }
}

async function reachRecipeEditor(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start recording' }).click()
  await page.getByRole('button', { name: 'Share window: Downloads - Finder' }).click()
  await page.waitForTimeout(150)
  await page.getByRole('button', { name: 'Stop and save' }).click()
  await page.getByRole('button', { name: 'Explain this workflow' }).click()
  await page
    .getByLabel('Where should TaskTape look for new videos and images?')
    .fill('My Downloads folder')
  await page
    .getByLabel('How do you decide which folder each file belongs in?')
    .fill('Sort by media type.')
  await page
    .getByLabel('What folder structure should TaskTape create or reuse?')
    .fill('Videos / Images')
  await page
    .getByLabel('Should TaskTape move the original files or keep a copy?')
    .selectOption('Move the originals')
  await page
    .getByLabel('What should happen when a file does not match any category?')
    .selectOption('Leave it where it is')
  await page.getByRole('button', { name: 'Save and review' }).click()
  await expect(page.getByRole('heading', { name: 'Set up the workflow' })).toBeVisible()
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

test('records, saves, and runs a real media workflow', async () => {
  const { application, userData } = await launchTestApp()
  const mediaInbox = join(userData, 'media-inbox')
  await mkdir(mediaInbox)
  await writeFile(join(mediaInbox, 'launch.mp4'), 'video fixture')
  await writeFile(join(mediaInbox, 'thumbnail.png'), 'image fixture')
  await writeFile(join(mediaInbox, 'brief.txt'), 'leave this file')

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
      .selectOption('Move the originals')
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

    await expect(page.getByRole('heading', { name: 'Set up the workflow' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Set up the workflow' })).toBeFocused()
    await expect(page.getByText('Answers saved', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save and review' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Edit answers' }).click()
    await expect(page.getByRole('heading', { name: 'A few quick questions' })).toBeVisible()
    await expect(
      page.getByLabel('How do you decide which folder each file belongs in?')
    ).toHaveValue('Group files by project, then by media type.')
    await page.getByRole('button', { name: 'Save and review' }).click()

    const editedGoal = 'Organize new creator videos and images into media folders.'
    await page.getByLabel('Goal').fill(editedGoal)
    await expect(page.getByLabel('Media folder')).toHaveValue('')
    await page.getByRole('button', { name: 'Choose folder' }).click()
    await expect(page.getByLabel('Media folder')).toHaveValue(mediaInbox)
    await expect(page.getByLabel('Videos go to')).toHaveValue('Raw Video')
    await expect(page.getByLabel('Images go to')).toHaveValue('Images')
    await expect(page.getByLabel('Move originals')).toBeChecked()
    await expect(page.getByLabel('Other files')).toHaveValue('move')
    await page.getByLabel('Other files').selectOption('leave')
    await page.screenshot({ path: 'output/playwright/workflow-recipe-editor.png' })
    await page.getByRole('button', { name: 'Save workflow' }).click()

    await expect(page.getByRole('heading', { name: 'Review and run' })).toBeVisible()
    await expect(page.getByText('Workflow saved', { exact: true })).toBeVisible()
    await expect(page.getByText(editedGoal, { exact: true })).toBeVisible()
    await expect(page.getByText('launch.mp4', { exact: true })).toBeVisible()
    await expect(page.getByText('thumbnail.png', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Run workflow' })).toBeDisabled()
    await page.getByLabel('I reviewed these file changes.').check()
    await expect(page.getByRole('button', { name: 'Run workflow' })).toBeEnabled()
    await page.screenshot({ path: 'output/playwright/workflow-run-approval.png' })
    await page.getByRole('button', { name: 'Run workflow' }).click()

    await expect(page.getByRole('heading', { name: '2 files updated' })).toBeVisible()
    await expect(page.getByText('Run completed', { exact: true })).toBeVisible()
    await expect(page.getByText('This result was written to the local activity log.')).toBeVisible()
    expect(await readFile(join(mediaInbox, 'Raw Video', 'launch.mp4'), 'utf8')).toBe(
      'video fixture'
    )
    expect(await readFile(join(mediaInbox, 'Images', 'thumbnail.png'), 'utf8')).toBe(
      'image fixture'
    )
    expect(await readFile(join(mediaInbox, 'brief.txt'), 'utf8')).toBe('leave this file')
    await expect(readFile(join(mediaInbox, 'launch.mp4'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(join(mediaInbox, 'thumbnail.png'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
    const workflowIds = await readdir(join(userData, 'workflows'))
    expect(workflowIds).toHaveLength(1)
    const runFiles = await readdir(join(userData, 'workflows', workflowIds[0], 'runs'))
    expect(runFiles).toHaveLength(1)
    const runLog = JSON.parse(
      await readFile(join(userData, 'workflows', workflowIds[0], 'runs', runFiles[0]), 'utf8')
    )
    expect(runLog).toMatchObject({ status: 'completed' })
    await page.screenshot({ path: 'output/playwright/workflow-run-complete.png' })

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

test('keeps natural folder answers out of execution and handles chooser cancellation', async () => {
  const { application, userData } = await launchTestApp({
    TASKTAPE_E2E_DIRECTORY_MODE: 'cancel'
  })

  try {
    const page = await application.firstWindow()
    await reachRecipeEditor(page)
    await expect(page.getByLabel('Media folder')).toHaveValue('')
    await page.getByRole('button', { name: 'Save workflow' }).click()
    await expect(page.getByRole('alert')).toHaveText(
      'Choose the media folder before saving this workflow.'
    )
    const visibleText = await page.locator('.recipe-editor').innerText()
    expect(visibleText).not.toContain('Error invoking remote method')
    expect(visibleText).not.toContain('sourceDirectory')
    await expect(readdir(join(userData, 'workflows'))).rejects.toMatchObject({ code: 'ENOENT' })
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
