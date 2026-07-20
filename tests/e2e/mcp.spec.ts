import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'
import { _electron as electron, expect, test } from '@playwright/test'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('shares one agent-recorded bug session with the TaskTape desktop app', async () => {
  test.setTimeout(60_000)
  const userData = await mkdtemp(join(tmpdir(), 'tasktape-agent-e2e-'))
  const fixtureHtml = await readFile(resolve('tests/fixtures/replay-target.html'), 'utf8')
  const fixtureServer = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' }).end(fixtureHtml)
  })
  await new Promise<void>((resolvePromise) => fixtureServer.listen(0, '127.0.0.1', resolvePromise))
  const address = fixtureServer.address()
  if (!address || typeof address === 'string') throw new Error('Fixture server did not start.')
  const targetUrl = `http://127.0.0.1:${address.port}`

  const packagedExecutable = process.env.TASKTAPE_PACKAGED_APP
  const application = await electron.launch({
    ...(packagedExecutable
      ? { executablePath: resolve(packagedExecutable) }
      : { args: [resolve('.')] }),
    env: { ...process.env, TASKTAPE_E2E: '1', TASKTAPE_USER_DATA: userData }
  })
  const page = await application.firstWindow()
  let client: Client | null = null

  try {
    await expect
      .poll(() => page.evaluate(() => window.tasktape.agent.getStatus()), { timeout: 10_000 })
      .toMatchObject({ running: true })
    const status = await page.evaluate(() => window.tasktape.agent.getStatus())
    client = new Client({ name: 'tasktape-electron-e2e', version: '1.0.0' })
    await client.connect(new StreamableHTTPClientTransport(new URL(status.endpoint)))

    await client.callTool({
      name: 'start_bug_session',
      arguments: {
        name: 'Agent captured category bug',
        url: targetUrl,
        expectedOutcome: 'Launch clip appears in Saved assets with the category Video.',
        issueContext: 'The selected category is lost after saving.'
      }
    })

    await page.bringToFront()
    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByText('Agent captured category bug', { exact: true })).toBeVisible({
      timeout: 5_000
    })
    await expect(page.getByText('0 recorded actions', { exact: true })).toBeVisible()

    const clicked = await client.callTool({
      name: 'click',
      arguments: { selector: { role: 'button', name: 'Save asset' } }
    })
    expect(JSON.stringify(clicked.content)).toContain('Uncategorized')

    const finished = CallToolResultSchema.parse(
      await client.callTool({ name: 'finish_bug_session', arguments: {} })
    )
    const text = finished.content.find((item) => item.type === 'text')
    if (!text || text.type !== 'text') throw new Error('TaskTape returned no session summary.')
    const summary = JSON.parse(text.text) as {
      sessionId: string
      workflowId: string
      traceFile: string
      finalScreenshotFile: string
    }
    const evidenceDirectory = join(userData, 'agent-sessions', summary.sessionId)
    expect((await stat(join(evidenceDirectory, summary.traceFile))).size).toBeGreaterThan(1_000)
    expect((await stat(join(evidenceDirectory, summary.finalScreenshotFile))).size).toBeGreaterThan(
      1_000
    )

    await page.getByRole('button', { name: 'Checks' }).click()
    await expect(page.getByText('Agent captured category bug', { exact: true })).toBeVisible({
      timeout: 5_000
    })
    await expect(page.getByText(/Expected: Launch clip appears/)).toBeVisible()
    await page
      .getByRole('button', { name: 'Review evidence for Agent captured category bug' })
      .click()
    await expect(page.locator('.evidence-summary')).toContainText('1 actions')
    await expect(page.locator('.evidence-summary')).toContainText('Ready trace')
    await page.getByRole('button', { name: 'Copy bug report' }).click()
    await expect(page.getByText('Bug report copied', { exact: true })).toBeVisible()
    const copiedReport = await application.evaluate(({ clipboard }) => clipboard.readText())
    expect(copiedReport).toContain('## Reproduction steps')
    expect(copiedReport).toContain('Launch clip appears in Saved assets')

    await page.getByRole('button', { name: 'Export Playwright' }).click()
    await expect(page.getByText('agent-captured-category-bug.spec.ts saved')).toBeVisible()
    const exportedTest = await readFile(
      join(userData, 'exports', 'agent-captured-category-bug.spec.ts'),
      'utf8'
    )
    expect(exportedTest).toContain(
      'page.getByRole("button", { name: "Save asset", exact: true }).click()'
    )
    expect(exportedTest).toContain('toHaveScreenshot("agent-captured-category-bug.png"')
    await page.addStyleTag({
      content: '*, *::before, *::after { animation: none !important; transition: none !important; }'
    })
    await page.waitForTimeout(100)
    await page.screenshot({ path: 'output/playwright/agent-created-check.png', fullPage: true })

    await page.getByRole('button', { name: 'Run Agent captured category bug' }).click()
    await expect(page.getByRole('heading', { name: 'Run history' })).toBeVisible()
    await expect(
      page.getByLabel('Workflow runs').getByText('Agent captured category bug', { exact: true })
    ).toBeVisible()
    await expect(page.getByText('Passed', { exact: true })).toBeVisible()

    expect(summary.workflowId).toMatch(/^[0-9a-f-]{36}$/)
  } finally {
    await client?.close().catch(() => undefined)
    await application.close()
    await new Promise<void>((resolvePromise) => fixtureServer.close(() => resolvePromise()))
    await rm(userData, { recursive: true, force: true })
  }
})
