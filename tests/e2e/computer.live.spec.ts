import { _electron as electron, chromium, expect, test } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const expectedText = 'TaskTape live computer test 2026-07-17.'

test.skip(
  process.env.TASKTAPE_LIVE_COMPUTER !== '1',
  'Set TASKTAPE_LIVE_COMPUTER=1 to run a real local computer task.'
)

test('runs one bounded task in a disposable local browser page', async () => {
  const userData = await mkdtemp(join(tmpdir(), 'tasktape-live-computer-'))
  const browser = await chromium.launch({ headless: false })
  const targetPage = await browser.newPage({ viewport: null })
  await targetPage.setContent(`
    <!doctype html>
    <html>
      <head><title>TaskTape Live Target</title></head>
      <body style="font-family: system-ui; padding: 80px;">
        <label for="target" style="display: block; font-size: 24px; margin-bottom: 16px;">
          Verification text
        </label>
        <textarea
          id="target"
          autofocus
          aria-label="Verification text"
          style="width: 720px; height: 220px; padding: 20px; font-size: 22px;"
        ></textarea>
      </body>
    </html>
  `)
  await targetPage.bringToFront()

  const application = await electron.launch({
    args: [resolve('.')],
    env: {
      ...process.env,
      TASKTAPE_USER_DATA: userData
    }
  })
  application.process().stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(chunk)
  })

  try {
    const page = await application.firstWindow()
    const workflowId = await page.evaluate(async () => {
      const workflow = await window.tasktape.workflow.save({
        name: 'Browser live verification',
        goal: 'Type the verification phrase in the blank local browser page.',
        instructions:
          'In the local browser page titled TaskTape Live Target, click the empty Verification text field and type exactly: TaskTape live computer test 2026-07-17. Do not submit, navigate, close, or interact with anything else. Stop after the text is visible.',
        approvalMode: 'allow_unattended',
        capability: 'computer',
        targetApp: 'Google Chrome for Testing'
      })
      await window.tasktape.workflow.saveSchedule({
        workflowId: workflow.id,
        frequency: 'daily',
        time: '23:59',
        weekday: null
      })
      return workflow.id
    })

    await page.getByRole('button', { name: 'Scheduled' }).click()
    await expect(page.getByText('Browser live verification', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Run now' }).click()
    await expect(page.getByRole('heading', { name: 'Run history' })).toBeVisible({
      timeout: 110_000
    })
    await expect(page.getByText('Browser live verification', { exact: true })).toBeVisible()

    const history = await page.evaluate(() => window.tasktape.workflow.history())
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      workflowName: 'Browser live verification',
      run: { status: 'completed', trigger: 'manual' }
    })
    expect(history[0].run.results.length).toBeGreaterThan(0)

    await expect(targetPage.getByLabel('Verification text')).toHaveValue(expectedText)

    expect(workflowId).toMatch(/^[0-9a-f-]{36}$/)
  } finally {
    await application.close()
    await browser.close()
    await rm(userData, { recursive: true, force: true })
  }
})
