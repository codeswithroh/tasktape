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
  await page
    .getByLabel('Your description')
    .fill('Organize new assets using the same structure I demonstrated every Monday at 9 AM.')
  await page.getByRole('button', { name: 'Build replay check' }).click()
  await expect(page.getByRole('heading', { name: 'What TaskTape learned' })).toBeVisible()
}

test('launches the isolated TaskTape shell', async () => {
  const { application, userData } = await launchTestApp()

  try {
    const page = await application.firstWindow()
    await expect(page).toHaveTitle('TaskTape')
    await expect(
      page.getByRole('heading', { name: 'Turn a bug into a living check' })
    ).toBeVisible()
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

test('learns, saves, and runs a demonstrated asset workflow', async () => {
  const { application, userData } = await launchTestApp({
    TASKTAPE_E2E_SCHEDULER_INTERVAL_MS: '100'
  })
  const mediaInbox = join(userData, 'media-inbox')
  await mkdir(mediaInbox)
  await writeFile(join(mediaInbox, 'launch.mp4'), 'video fixture')
  await writeFile(join(mediaInbox, 'thumbnail.png'), 'image fixture')
  await writeFile(join(mediaInbox, 'brand-assets.zip'), 'package fixture')
  await writeFile(join(mediaInbox, 'brief.txt'), 'leave this file')

  try {
    const page = await application.firstWindow()
    const rendererErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') rendererErrors.push(message.text())
    })
    page.on('pageerror', (error) => rendererErrors.push(error.message))
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

    await expect(page.getByRole('heading', { name: 'Describe the expected result' })).toBeVisible()
    await expect(page.getByTestId('recording-preview')).toBeVisible()
    await expect(page.getByTestId('frame-count')).toHaveText('1')
    const extractedFrame = page.getByTestId('key-frame')
    expect(await extractedFrame.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(
      1280
    )
    expect(await extractedFrame.getAttribute('src')).toMatch(/^data:image\/jpeg;base64,/)
    expect(await readdir(join(userData, 'recordings'))).toHaveLength(2)

    await page.getByRole('button', { name: 'Record voice note' }).click()
    await expect(page.getByText('Listening', { exact: true })).toBeVisible()
    await page.waitForTimeout(250)
    await page.getByRole('button', { name: 'Stop voice note' }).click()
    await expect(page.getByLabel('Your description')).toHaveValue(
      'Organize new assets using the structure I demonstrated every Monday at 9 AM, and leave anything unmatched in place.'
    )
    const statedIntent =
      'Organize new assets the same way I demonstrated every Monday at 9 AM. Leave anything unrelated alone.'
    await page.getByLabel('Your description').fill(statedIntent)
    await page.screenshot({ path: 'output/playwright/voice-intent.png' })
    await page.getByRole('button', { name: 'Build replay check' }).click()
    await page.setViewportSize({ width: 1180, height: 760 })

    const learnedHeading = page.getByRole('heading', { name: 'What TaskTape learned' })
    await expect(learnedHeading).toBeVisible()
    await expect(learnedHeading).toBeFocused()
    const playbackBox = await page.getByTestId('recording-preview').boundingBox()
    expect(playbackBox?.width).toBeGreaterThan(300)
    await expect(page.getByText('Task understood', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'What TaskTape learned' })).toBeVisible()
    await expect(page.getByText('Notice new assets', { exact: true })).toBeVisible()
    await expect(page.getByText('Project footage', { exact: true })).toBeVisible()
    await expect(page.getByText('Raw Video', { exact: true })).toBeVisible()
    await expect(page.getByText('Project packages', { exact: true })).toBeVisible()
    await expect(page.getByText('Deliverables', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Videos go to')).toHaveCount(0)
    await expect(page.getByLabel('Images go to')).toHaveCount(0)

    const editedGoal = 'Place new project assets into the demonstrated folder structure.'
    await page.getByLabel('Goal').fill(editedGoal)
    await expect(page.getByLabel('Folder this workflow can access')).toHaveValue('')
    await page.getByRole('button', { name: 'Choose folder' }).click()
    await expect(page.getByLabel('Folder this workflow can access')).toHaveValue(mediaInbox)
    await page.getByLabel('Every week').check()
    await page.getByLabel('Day', { exact: true }).selectOption('1')
    await page.getByLabel('Time', { exact: true }).fill('09:00')
    await page
      .getByLabel('Allow TaskTape to run this task automatically at the scheduled time.')
      .check()
    await page.screenshot({ path: 'output/playwright/workflow-recipe-editor.png' })
    await page.getByRole('button', { name: 'Save task' }).click()

    await expect(page.getByRole('heading', { name: 'Review and run' })).toBeVisible()
    await expect(page.getByText('Task saved', { exact: true })).toBeVisible()

    const workflowIds = await readdir(join(userData, 'workflows'))
    expect(workflowIds).toHaveLength(1)
    const schedulePath = join(userData, 'workflows', workflowIds[0], 'schedule.json')
    const schedule = JSON.parse(await readFile(schedulePath, 'utf8'))
    expect(schedule).toMatchObject({
      enabled: true,
      frequency: 'weekly',
      weekday: 1,
      time: '09:00'
    })

    await expect(page.getByText(editedGoal, { exact: true })).toBeVisible()
    await expect(page.getByText('launch.mp4', { exact: true })).toBeVisible()
    await expect(page.getByText('thumbnail.png', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Run task' })).toBeDisabled()
    await page.getByLabel('I reviewed these changes.').check()
    await expect(page.getByRole('button', { name: 'Run task' })).toBeEnabled()
    await page.screenshot({ path: 'output/playwright/workflow-run-approval.png' })
    await page.getByRole('button', { name: 'Run task' }).click()

    await expect(page.getByRole('heading', { name: '3 items updated' })).toBeVisible()
    await expect(page.getByText('Run completed', { exact: true })).toBeVisible()
    await expect(page.getByText('The run is complete and saved in your history.')).toBeVisible()
    expect(await readFile(join(mediaInbox, 'Raw Video', 'launch.mp4'), 'utf8')).toBe(
      'video fixture'
    )
    expect(await readFile(join(mediaInbox, 'Images', 'thumbnail.png'), 'utf8')).toBe(
      'image fixture'
    )
    expect(await readFile(join(mediaInbox, 'Deliverables', 'brand-assets.zip'), 'utf8')).toBe(
      'package fixture'
    )
    expect(await readFile(join(mediaInbox, 'brief.txt'), 'utf8')).toBe('leave this file')
    await expect(readFile(join(mediaInbox, 'launch.mp4'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(join(mediaInbox, 'thumbnail.png'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
    await expect(readFile(join(mediaInbox, 'brand-assets.zip'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
    const runFiles = await readdir(join(userData, 'workflows', workflowIds[0], 'runs'))
    expect(runFiles).toHaveLength(1)
    const runLog = JSON.parse(
      await readFile(join(userData, 'workflows', workflowIds[0], 'runs', runFiles[0]), 'utf8')
    )
    expect(runLog).toMatchObject({ status: 'completed', trigger: 'manual' })
    await page.screenshot({ path: 'output/playwright/workflow-run-complete.png' })

    await writeFile(join(mediaInbox, 'weekly.mp4'), 'scheduled video fixture')
    await writeFile(
      schedulePath,
      `${JSON.stringify({ ...schedule, nextRunAt: new Date(Date.now() - 1_000).toISOString() }, null, 2)}\n`
    )
    await expect
      .poll(() => readFile(join(mediaInbox, 'Raw Video', 'weekly.mp4'), 'utf8').catch(() => null))
      .toBe('scheduled video fixture')

    await page.getByRole('button', { name: 'View run history' }).click()
    await expect(page.getByRole('heading', { name: 'Run history' })).toBeVisible()
    await expect(page.getByText('Organize project assets', { exact: true })).toHaveCount(2)
    await expect(page.getByText('Manual', { exact: true })).toBeVisible()
    await expect(
      page.getByLabel('Workflow runs').getByText('Scheduled', { exact: true })
    ).toBeVisible()
    await expect(page.getByText('3 updated', { exact: true })).toBeVisible()
    await expect(page.getByText('1 updated', { exact: true })).toBeVisible()
    await page.screenshot({ path: 'output/playwright/run-history.png' })

    await page.getByRole('button', { name: 'Checks' }).click()
    await expect(page.getByRole('heading', { name: '3 items updated' })).toBeVisible()
    const newWorkflowButton = page.locator('.run-result').getByRole('button', { name: 'New task' })
    await page.locator('.workspace').evaluate((element) => element.scrollTo({ top: 0 }))
    await newWorkflowButton.scrollIntoViewIfNeeded()
    await expect(newWorkflowButton).toBeVisible()
    await expect(newWorkflowButton).toBeEnabled()
    await newWorkflowButton.click()

    await page.addStyleTag({
      content: '*, *::before, *::after { animation: none !important; transition: none !important; }'
    })
    await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible()
    expect(await readdir(join(userData, 'recordings'))).toHaveLength(0)
    expect(rendererErrors).toEqual([])
  } finally {
    await application.close()
    await rm(userData, { recursive: true, force: true })
  }
})

test('keeps an empty saved workflow actionable', async () => {
  const { application, userData } = await launchTestApp()
  await mkdir(join(userData, 'media-inbox'))

  try {
    const page = await application.firstWindow()
    await page.setViewportSize({ width: 900, height: 620 })
    await reachRecipeEditor(page)
    await page.getByRole('heading', { name: 'When should it run?' }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('heading', { name: 'When should it run?' })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true)
    await page.getByRole('button', { name: 'Choose folder' }).click()
    await page.getByLabel('On demand').check()
    await page.getByRole('button', { name: 'Save task' }).click()

    await expect(page.getByRole('heading', { name: 'Review and run' })).toBeVisible()
    await expect(page.getByText('Nothing needs to change right now.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Check again' })).toBeEnabled()
    const newWorkflowButton = page.locator('.plan-review').getByRole('button', { name: 'New task' })
    await expect(newWorkflowButton).toBeEnabled()
    await page.screenshot({ path: 'output/playwright/empty-workflow-saved.png' })
    await newWorkflowButton.click()
    await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible()
    expect(await readdir(join(userData, 'recordings'))).toHaveLength(0)
  } finally {
    await application.close()
    await rm(userData, { recursive: true, force: true })
  }
})

test('saves and runs a learned computer task', async () => {
  const { application, userData } = await launchTestApp({
    TASKTAPE_E2E_ANALYSIS: 'computer'
  })

  try {
    const page = await application.firstWindow()
    await page.getByRole('button', { name: 'Start recording' }).click()
    await page.getByRole('button', { name: 'Share window: Creator dashboard - Browser' }).click()
    await page.waitForTimeout(150)
    await page.getByRole('button', { name: 'Stop and save' }).click()
    await page
      .getByLabel('Your description')
      .fill('Review my weekly project update and publish it to the team workspace.')
    await page.getByRole('button', { name: 'Build replay check' }).click()

    await expect(page.getByText('What TaskTape learned', { exact: true })).toBeVisible()
    await expect(page.getByText('Review the update', { exact: true })).toBeVisible()
    await expect(page.getByText('Publish to the workspace', { exact: true })).toBeVisible()
    await expect(page.getByText('Computer access', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Task instructions')).toHaveValue(/team workspace/)
    await expect(page.getByText('Folder access', { exact: true })).toHaveCount(0)
    await page.getByLabel('Every week').check()
    await page.getByLabel('Day', { exact: true }).selectOption('1')
    await page.getByLabel('Time', { exact: true }).fill('09:00')
    await page
      .getByLabel('Allow TaskTape to run this task automatically at the scheduled time.')
      .check()
    await page.getByRole('button', { name: 'Save task' }).click()

    await expect(page.getByText('Task saved', { exact: true })).toBeVisible()
    await expect(page.getByText('Starts in Browser', { exact: true })).toBeVisible()
    await page.getByLabel('I reviewed the task and expected result.').check()
    await page.getByRole('button', { name: 'Run task' }).click()
    await expect(page.getByText('Check passed', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Expected result confirmed' })).toBeVisible()
    await expect(page.getByText('The expected result is visible.')).toBeVisible()
    await page.screenshot({ path: 'output/playwright/computer-task-complete.png' })

    await page.getByRole('button', { name: 'Scheduled' }).click()
    await expect(page.getByRole('heading', { name: 'Scheduled', exact: true })).toBeVisible()
    await expect(page.getByText('Publish weekly project update', { exact: true })).toBeVisible()
    await expect(page.getByText('Every Monday at 9:00 AM', { exact: true })).toBeVisible()
    const pauseSwitch = page.getByRole('switch', { name: 'Pause Publish weekly project update' })
    await pauseSwitch.focus()
    await pauseSwitch.press('Space')
    await expect(page.getByText('Paused', { exact: true }).first()).toBeVisible()
    const resumeSwitch = page.getByRole('switch', { name: 'Resume Publish weekly project update' })
    await resumeSwitch.focus()
    await resumeSwitch.press('Space')
    await expect(page.getByText('Active', { exact: true })).toBeVisible()
    await page.addStyleTag({
      content: '*, *::before, *::after { animation: none !important; transition: none !important; }'
    })
    await page.waitForTimeout(100)
    await page.screenshot({ path: 'output/playwright/scheduled-tasks.png' })
    await page.getByRole('button', { name: 'Run now' }).click()
    await expect(page.getByRole('heading', { name: 'Run history' })).toBeVisible()
    await expect(page.getByText('Publish weekly project update', { exact: true })).toHaveCount(2)
  } finally {
    await application.close()
    await rm(userData, { recursive: true, force: true })
  }
})

test('shows failed replay evidence and preserves it in history', async () => {
  const { application, userData } = await launchTestApp({
    TASKTAPE_E2E_ANALYSIS: 'computer',
    TASKTAPE_E2E_VERIFICATION: 'failed'
  })

  try {
    const page = await application.firstWindow()
    await page.getByRole('button', { name: 'Start recording' }).click()
    await page.getByRole('button', { name: 'Share window: Creator dashboard - Browser' }).click()
    await page.waitForTimeout(150)
    await page.getByRole('button', { name: 'Stop and save' }).click()
    await page
      .getByLabel('Your description')
      .fill('Save the asset and confirm that it still has the Video category.')
    await page.getByRole('button', { name: 'Build replay check' }).click()
    await expect(page.locator('#expected-outcome')).toHaveValue(/visibly published/)
    await page.getByLabel('On demand').check()
    await page.getByRole('button', { name: 'Save task' }).click()
    await page.getByLabel('I reviewed the task and expected result.').check()
    await page.getByRole('button', { name: 'Run task' }).click()

    await expect(page.getByText('Check failed', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Regression found' })).toBeVisible()
    await expect(page.getByText('The saved item is labeled Uncategorized.')).toBeVisible()
    await page.screenshot({ path: 'output/playwright/replay-regression-found.png' })

    await page.getByRole('button', { name: 'View run history' }).click()
    await expect(page.getByRole('heading', { name: 'Run history' })).toBeVisible()
    await expect(
      page.locator('.history-list').getByText('Regression found', { exact: true })
    ).toBeVisible()
    await page
      .locator('.history-list details')
      .first()
      .evaluate((details) => {
        details.open = true
      })
    await expect(
      page
        .locator('.history-list')
        .getByText('The saved item does not retain the expected category.')
    ).toBeVisible()
    await page.screenshot({ path: 'output/playwright/replay-failed-history.png' })
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
    await expect(page.getByLabel('Folder this workflow can access')).toHaveValue('')
    await page.getByLabel('On demand').check()
    await page.getByRole('button', { name: 'Save task' }).click()
    await expect(page.getByRole('alert')).toHaveText(
      'Choose the folder this task can access before saving.'
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
