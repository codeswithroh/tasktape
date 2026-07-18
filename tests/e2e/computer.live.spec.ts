import { _electron as electron, chromium, expect, test } from '@playwright/test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const expectedOutcome =
  'After Save, the item titled Launch clip appears in Saved assets with the category Video.'

test.skip(
  process.env.TASKTAPE_LIVE_COMPUTER !== '1',
  'Set TASKTAPE_LIVE_COMPUTER=1 to run a real local computer task.'
)

test('replays and verifies the same broken and fixed desktop workflow', async () => {
  test.setTimeout(300_000)
  const userData = await mkdtemp(join(tmpdir(), 'tasktape-live-replay-'))
  const browser = await chromium.launch({ headless: false, args: ['--kiosk'] })
  const brokenPage = await browser.newPage({ viewport: null })
  const fixedPage = await browser.newPage({ viewport: null })
  const targetHtml = await readFile(resolve('tests/fixtures/replay-target.html'), 'utf8')

  const prepareTarget = async (
    targetPage: typeof brokenPage,
    mode: 'broken' | 'fixed'
  ): Promise<void> => {
    await targetPage.setContent(targetHtml.replace('<body>', `<body data-mode="${mode}">`), {
      waitUntil: 'load'
    })
  }

  await prepareTarget(brokenPage, 'broken')
  await prepareTarget(fixedPage, 'fixed')
  await brokenPage.bringToFront()

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
    const runCheck = async (name: string) =>
      page.evaluate(
        async ({ checkName, outcome }) => {
          const workflow = await window.tasktape.workflow.save({
            name: checkName,
            goal: 'Verify that a saved creator asset retains its selected category.',
            instructions:
              'In the browser page titled Replay Target, click the large green Save asset button once. Leave the title as Launch clip and category as Video. Do not change any field, navigate, close, or interact with anything else. Stop immediately when an item appears under Saved assets.',
            expectedOutcome: outcome,
            approvalMode: 'review_each_run',
            capability: 'computer',
            targetApp: 'Google Chrome for Testing'
          })
          return window.tasktape.workflow.runTask(workflow.id)
        },
        { checkName: name, outcome: expectedOutcome }
      )

    const brokenRun = await runCheck('Creator asset regression')
    if (!brokenRun.verification) {
      throw new Error(brokenRun.results.map((result) => result.message).join('\n'))
    }
    await mkdir(resolve('output/live'), { recursive: true })
    await writeFile(
      resolve('output/live/replay-broken-final.png'),
      Buffer.from(brokenRun.verification!.screenshotDataUrl.split(',')[1], 'base64')
    )
    expect(brokenRun).toMatchObject({
      status: 'failed',
      verification: { status: 'failed', expectedOutcome }
    })
    await expect(brokenPage.locator('#saved-result')).toContainText('Uncategorized')

    await fixedPage.bringToFront()
    await fixedPage.waitForTimeout(500)
    const fixedRun = await runCheck('Creator asset fixed build')
    if (!fixedRun.verification) {
      throw new Error(fixedRun.results.map((result) => result.message).join('\n'))
    }
    await writeFile(
      resolve('output/live/replay-fixed-final.png'),
      Buffer.from(fixedRun.verification!.screenshotDataUrl.split(',')[1], 'base64')
    )
    await expect(fixedPage.locator('#saved-result')).toContainText('Video')
    expect(fixedRun).toMatchObject({
      status: 'completed',
      verification: { status: 'passed', expectedOutcome }
    })

    await page.getByRole('button', { name: 'Run history' }).click()
    await expect(page.getByText('Creator asset regression', { exact: true })).toBeVisible()
    await expect(page.getByText('Creator asset fixed build', { exact: true })).toBeVisible()
    await expect(page.getByText('Regression found', { exact: true })).toBeVisible()
    await expect(page.getByText('Passed', { exact: true })).toBeVisible()

    const history = await page.evaluate(() => window.tasktape.workflow.history())
    expect(history).toHaveLength(2)
    expect(history.map((entry) => entry.run.verification?.status).sort()).toEqual([
      'failed',
      'passed'
    ])
  } finally {
    await application.close()
    await browser.close()
    await rm(userData, { recursive: true, force: true })
  }
})
