import { createServer, type Server } from 'node:http'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { chromium } from 'playwright-core'
import { afterEach, describe, expect, it } from 'vitest'

import { bugSessionSchema } from '../shared/agent-schema.js'
import { savedWorkflowSchema } from '../shared/workflow-schema.js'
import { BrowserEvidenceManager, compileReplayInstructions } from './browser-evidence.js'
import { readWorkflow, saveWorkflow } from './workflows.js'

const cleanup: Array<() => Promise<void>> = []

afterEach(async () => {
  for (const task of cleanup.splice(0).reverse()) await task()
})

async function fixtureServer(): Promise<{ server: Server; url: string }> {
  const html = await readFile(resolve('tests/fixtures/replay-target.html'), 'utf8')
  const instrumented = html.replace(
    '</body>',
    `<script>console.error('Fixture category regression'); fetch('/missing')</script></body>`
  )
  const server = createServer((request, response) => {
    if (request.url === '/missing') {
      response.writeHead(503).end('Unavailable')
      return
    }
    response.writeHead(200, { 'content-type': 'text/html' }).end(instrumented)
  })
  await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise))
  cleanup.push(() => new Promise<void>((resolvePromise) => server.close(() => resolvePromise())))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Fixture server did not start.')
  return { server, url: `http://127.0.0.1:${address.port}` }
}

describe('browser evidence manager', () => {
  it('captures a broken browser flow and compiles it into a saved Replay check', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tasktape-agent-session-'))
    cleanup.push(() => rm(root, { recursive: true, force: true }))
    const { url } = await fixtureServer()
    const workflowsRoot = join(root, 'workflows')
    const manager = new BrowserEvidenceManager({
      sessionsRoot: join(root, 'agent-sessions'),
      saveComputerWorkflow: (input) => saveWorkflow(workflowsRoot, input),
      launchBrowser: () => chromium.launch({ headless: true })
    })
    cleanup.push(() => manager.close())

    const started = await manager.start({
      name: 'Creator category regression',
      url,
      expectedOutcome: 'Launch clip appears in Saved assets with the category Video.',
      issueContext: 'The selected category is lost after saving.'
    })
    expect(started).toMatchObject({ title: 'Replay Target', url: `${url}/` })
    expect(started.accessibility).toContain('Save asset')

    await manager.selectOption({ selector: { label: 'Category' }, value: 'Video' })
    const clicked = await manager.click({ selector: { role: 'button', name: 'Save asset' } })
    expect(clicked.accessibility).toContain('Uncategorized')
    await manager.addNote({ note: 'The selected Video category became Uncategorized.' })

    const finished = await manager.finish()
    const sessionDirectory = finished.directory
    const persistedSession = bugSessionSchema.parse(
      JSON.parse(await readFile(join(sessionDirectory, 'session.json'), 'utf8'))
    )
    const workflow = savedWorkflowSchema.parse(
      await readWorkflow(workflowsRoot, finished.workflow.id)
    )

    expect(persistedSession).toMatchObject({
      status: 'completed',
      workflowId: workflow.id,
      finalScreenshotFile: 'screenshots/final.png'
    })
    expect(persistedSession.actions.map((action) => action.type)).toEqual([
      'select_option',
      'click',
      'note'
    ])
    expect(
      persistedSession.console.some((event) => event.summary.includes('category regression'))
    ).toBe(true)
    expect(persistedSession.network.some((event) => event.type === 'http-503')).toBe(true)
    expect((await stat(join(sessionDirectory, persistedSession.traceFile))).size).toBeGreaterThan(
      1_000
    )
    expect(
      (await stat(join(sessionDirectory, persistedSession.initialScreenshotFile))).size
    ).toBeGreaterThan(1_000)
    expect(
      (await stat(join(sessionDirectory, persistedSession.finalScreenshotFile ?? ''))).size
    ).toBeGreaterThan(1_000)
    expect(workflow).toMatchObject({
      capability: 'computer',
      approvalMode: 'review_each_run',
      targetApp: 'Google Chrome',
      expectedOutcome: 'Launch clip appears in Saved assets with the category Video.'
    })
    expect(workflow.instructions).toContain(`Open ${url}`)
    expect(workflow.instructions).toContain('Click the button named "Save asset".')
  }, 20_000)

  it('refuses a second active session and compiles only executable actions', async () => {
    const session = bugSessionSchema.parse({
      version: 1,
      id: crypto.randomUUID(),
      name: 'Local bug',
      url: 'http://localhost:3000',
      expectedOutcome: 'The confirmation appears.',
      issueContext: '',
      status: 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      actions: [
        {
          id: crypto.randomUUID(),
          type: 'note',
          summary: 'Agent note: inspect the response.',
          createdAt: new Date().toISOString(),
          screenshotFile: null
        }
      ],
      console: [],
      network: [],
      initialScreenshotFile: 'screenshots/000-initial.png',
      finalScreenshotFile: 'screenshots/final.png',
      traceFile: 'trace.zip',
      replayInstructions: null,
      workflowId: null
    })
    expect(compileReplayInstructions(session)).toContain('Inspect the page without changing it.')
    expect(compileReplayInstructions(session)).not.toContain('Agent note')
  })
})
