import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'
import { createServer, type Server } from 'node:http'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { chromium } from 'playwright-core'
import { afterEach, describe, expect, it } from 'vitest'

import { workflowRunSchema } from '../shared/workflow-schema.js'
import { AgentMcpServer } from './agent-mcp.js'
import { BrowserEvidenceManager } from './browser-evidence.js'
import { listWorkflowHistory, listWorkflows, saveWorkflow } from './workflows.js'

const cleanup: Array<() => Promise<void>> = []

afterEach(async () => {
  for (const task of cleanup.splice(0).reverse()) await task()
})

async function fixtureServer(): Promise<string> {
  const html = await readFile(resolve('tests/fixtures/replay-target.html'), 'utf8')
  const server: Server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' }).end(html)
  })
  await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise))
  cleanup.push(() => new Promise<void>((resolvePromise) => server.close(() => resolvePromise())))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Fixture server did not start.')
  return `http://127.0.0.1:${address.port}`
}

describe('TaskTape MCP server', () => {
  it('lets a real MCP client record a broken flow and create a Replay check', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tasktape-mcp-'))
    cleanup.push(() => rm(root, { recursive: true, force: true }))
    const targetUrl = await fixtureServer()
    const workflowsRoot = join(root, 'workflows')
    const manager = new BrowserEvidenceManager({
      sessionsRoot: join(root, 'agent-sessions'),
      saveComputerWorkflow: (input) => saveWorkflow(workflowsRoot, input),
      launchBrowser: () => chromium.launch({ headless: true })
    })
    const sampleRun = workflowRunSchema.parse({
      version: 1,
      id: crypto.randomUUID(),
      workflowId: crypto.randomUUID(),
      planId: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: 'completed',
      trigger: 'manual',
      verification: null,
      results: []
    })
    const mcp = new AgentMcpServer({
      manager,
      runCheck: async () => sampleRun,
      listChecks: () => listWorkflows(workflowsRoot),
      listRuns: async () => [],
      port: 0
    })
    const status = await mcp.start()
    cleanup.push(() => mcp.stop())

    const client = new Client({ name: 'tasktape-test-client', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(new URL(status.endpoint))
    await client.connect(transport)
    cleanup.push(async () => {
      await client.close()
    })

    const tools = await client.listTools()
    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'start_bug_session',
        'observe_page',
        'click',
        'finish_bug_session',
        'run_check'
      ])
    )

    const started = await client.callTool({
      name: 'start_bug_session',
      arguments: {
        name: 'Creator category regression',
        url: targetUrl,
        expectedOutcome: 'Launch clip appears in Saved assets with the category Video.',
        issueContext: 'Saving loses the selected category.'
      }
    })
    expect(started.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'image', mimeType: 'image/png' })])
    )

    const clicked = await client.callTool({
      name: 'click',
      arguments: { selector: { role: 'button', name: 'Save asset' } }
    })
    expect(JSON.stringify(clicked.content)).toContain('Uncategorized')

    const finished = CallToolResultSchema.parse(
      await client.callTool({ name: 'finish_bug_session', arguments: {} })
    )
    const finishedText = finished.content.find((item) => item.type === 'text')
    if (!finishedText || finishedText.type !== 'text') throw new Error('Missing MCP result text.')
    const summary = JSON.parse(finishedText.text) as {
      sessionId: string
      workflowId: string
      traceFile: string
    }
    const workflows = await listWorkflows(workflowsRoot)
    expect(workflows).toHaveLength(1)
    expect(workflows[0]).toMatchObject({
      id: summary.workflowId,
      capability: 'computer',
      expectedOutcome: 'Launch clip appears in Saved assets with the category Video.'
    })

    const sessionDirectory = join(root, 'agent-sessions', summary.sessionId)
    expect((await stat(join(sessionDirectory, summary.traceFile))).size).toBeGreaterThan(1_000)
    const session = JSON.parse(await readFile(join(sessionDirectory, 'session.json'), 'utf8')) as {
      finalScreenshotFile: string
    }
    expect((await stat(join(sessionDirectory, session.finalScreenshotFile))).size).toBeGreaterThan(
      1_000
    )

    const listed = await client.callTool({ name: 'list_checks', arguments: {} })
    expect(JSON.stringify(listed.content)).toContain('Creator category regression')
    expect(await listWorkflowHistory(workflowsRoot)).toHaveLength(0)
  }, 30_000)
})
