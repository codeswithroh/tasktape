import type { Server as NodeHttpServer } from 'node:http'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'

import {
  addSessionNoteInputSchema,
  clickInputSchema,
  fillInputSchema,
  finishBugSessionInputSchema,
  pressKeyInputSchema,
  selectOptionInputSchema,
  startBugSessionInputSchema,
  waitForInputSchema,
  type AgentServerStatus
} from '../shared/agent-schema.js'
import {
  workflowIdSchema,
  type SavedWorkflow,
  type WorkflowRun
} from '../shared/workflow-schema.js'
import {
  BrowserEvidenceManager,
  type BrowserObservation,
  type FinishedBugSession
} from './browser-evidence.js'

export const TASKTAPE_MCP_DEFAULT_PORT = 19_790

export interface AgentMcpServerOptions {
  manager: BrowserEvidenceManager
  runCheck: (workflowId: string) => Promise<WorkflowRun>
  listChecks: () => Promise<SavedWorkflow[]>
  listRuns: () => Promise<Array<{ workflowName: string; run: WorkflowRun }>>
  port?: number
}

function observationContent(observation: BrowserObservation) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            sessionId: observation.sessionId,
            title: observation.title,
            url: observation.url,
            accessibility: observation.accessibility
          },
          null,
          2
        )
      },
      {
        type: 'image' as const,
        data: observation.screenshot.toString('base64'),
        mimeType: 'image/png'
      }
    ]
  }
}

function finishedSessionContent(result: FinishedBugSession) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            sessionId: result.session.id,
            workflowId: result.workflow.id,
            checkName: result.workflow.name,
            expectedOutcome: result.session.expectedOutcome,
            actionsRecorded: result.session.actions.length,
            consoleEvents: result.session.console.length,
            networkEvents: result.session.network.length,
            traceFile: result.session.traceFile,
            finalScreenshotFile: result.session.finalScreenshotFile,
            next: 'Call run_check with the workflowId when you are ready to replay and verify it.'
          },
          null,
          2
        )
      }
    ]
  }
}

function runContent(run: WorkflowRun) {
  const screenshot = run.verification?.screenshotDataUrl
  const summary = {
    ...run,
    verification: run.verification
      ? { ...run.verification, screenshotDataUrl: undefined }
      : run.verification
  }
  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType: 'image/png' | 'image/jpeg' }
  > = [{ type: 'text', text: JSON.stringify(summary, null, 2) }]
  if (screenshot) {
    const match = screenshot.match(/^data:image\/(png|jpeg);base64,(.+)$/)
    if (match) {
      content.push({
        type: 'image',
        data: match[2],
        mimeType: match[1] === 'jpeg' ? 'image/jpeg' : 'image/png'
      })
    }
  }
  return { content }
}

function createTaskTapeMcpServer(options: AgentMcpServerOptions): McpServer {
  const server = new McpServer(
    { name: 'tasktape', version: '0.1.0' },
    {
      instructions:
        'Use TaskTape to reproduce bugs in local web applications. Start one session, operate only its TaskTape-created browser, record the visible failure, then finish the session to create a Replay check. Finishing never runs or schedules the check.'
    }
  )

  server.registerTool(
    'start_bug_session',
    {
      title: 'Start bug session',
      description:
        'Launch a headed isolated browser at a local development URL and begin recording trace, screenshots, console messages, network failures, and agent actions.',
      inputSchema: startBugSessionInputSchema.shape
    },
    async (input) => observationContent(await options.manager.start(input))
  )

  server.registerTool(
    'observe_page',
    {
      title: 'Observe page',
      description:
        'Inspect the active debugging page. Returns its URL, title, accessibility snapshot, and current screenshot without changing it.',
      inputSchema: {},
      annotations: { readOnlyHint: true }
    },
    async () => observationContent(await options.manager.observe())
  )

  server.registerTool(
    'click',
    {
      title: 'Click page element',
      description:
        'Click one element in the active TaskTape browser using an accessible role, label, visible text, or CSS selector.',
      inputSchema: clickInputSchema.shape
    },
    async (input) => observationContent(await options.manager.click(input))
  )

  server.registerTool(
    'fill',
    {
      title: 'Fill page field',
      description:
        'Fill a non-password field in the active TaskTape browser. The value becomes part of the local replay evidence.',
      inputSchema: fillInputSchema.shape
    },
    async (input) => observationContent(await options.manager.fill(input))
  )

  server.registerTool(
    'select_option',
    {
      title: 'Select page option',
      description: 'Choose a value from a select element in the active TaskTape browser.',
      inputSchema: selectOptionInputSchema.shape
    },
    async (input) => observationContent(await options.manager.selectOption(input))
  )

  server.registerTool(
    'press_key',
    {
      title: 'Press browser key',
      description:
        'Press one validated Playwright key or key chord in the active TaskTape browser.',
      inputSchema: pressKeyInputSchema.shape
    },
    async (input) => observationContent(await options.manager.pressKey(input))
  )

  server.registerTool(
    'wait_for',
    {
      title: 'Wait for page',
      description: 'Wait for visible text or for a bounded duration of at most five seconds.',
      inputSchema: waitForInputSchema.shape,
      annotations: { readOnlyHint: true }
    },
    async (input) => observationContent(await options.manager.waitFor(input))
  )

  server.registerTool(
    'add_note',
    {
      title: 'Add debugging note',
      description:
        'Attach concise issue context or an observation to the active evidence session without changing the page.',
      inputSchema: addSessionNoteInputSchema.shape,
      annotations: { readOnlyHint: true }
    },
    async (input) => {
      const session = await options.manager.addNote(input)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ sessionId: session.id, actionsRecorded: session.actions.length })
          }
        ]
      }
    }
  )

  server.registerTool(
    'finish_bug_session',
    {
      title: 'Finish bug session',
      description:
        'Persist the final screenshot and trace, close the instrumented browser, and compile the recorded actions into a saved TaskTape Replay check. This does not execute or schedule the check.',
      inputSchema: finishBugSessionInputSchema.shape
    },
    async (input) => finishedSessionContent(await options.manager.finish(input))
  )

  server.registerTool(
    'list_checks',
    {
      title: 'List Replay checks',
      description: 'List saved computer Replay checks without running them.',
      inputSchema: {},
      annotations: { readOnlyHint: true }
    },
    async () => {
      const workflows = (await options.listChecks())
        .filter((workflow) => workflow.capability === 'computer')
        .map((workflow) => ({
          id: workflow.id,
          name: workflow.name,
          goal: workflow.goal,
          expectedOutcome: workflow.expectedOutcome,
          updatedAt: workflow.updatedAt
        }))
      return { content: [{ type: 'text', text: JSON.stringify(workflows, null, 2) }] }
    }
  )

  server.registerTool(
    'run_check',
    {
      title: 'Run Replay check',
      description:
        'Explicitly run one saved Replay check through TaskTape computer use and visual outcome verification.',
      inputSchema: { workflowId: workflowIdSchema }
    },
    async ({ workflowId }) => runContent(await options.runCheck(workflowId))
  )

  server.registerTool(
    'get_run_result',
    {
      title: 'Get run result',
      description: 'Retrieve a persisted Replay verdict and its final screenshot evidence.',
      inputSchema: { runId: z.string().uuid() },
      annotations: { readOnlyHint: true }
    },
    async ({ runId }) => {
      const entry = (await options.listRuns()).find((candidate) => candidate.run.id === runId)
      if (!entry) throw new Error('That TaskTape run does not exist.')
      return runContent(entry.run)
    }
  )

  return server
}

export class AgentMcpServer {
  private httpServer: NodeHttpServer | null = null
  private actualPort: number

  constructor(private readonly options: AgentMcpServerOptions) {
    this.actualPort = options.port ?? TASKTAPE_MCP_DEFAULT_PORT
  }

  get status(): AgentServerStatus {
    const active = this.options.manager.activeSession
    return {
      running: this.httpServer !== null,
      endpoint: `http://127.0.0.1:${this.actualPort}/mcp`,
      activeSession: active
        ? { id: active.id, name: active.name, url: active.url, actionCount: active.actions.length }
        : null
    }
  }

  async start(): Promise<AgentServerStatus> {
    if (this.httpServer) return this.status
    const app = createMcpExpressApp({ host: '127.0.0.1' })
    app.use((request, response, next) => {
      const origin = request.get('origin')
      if (origin && !/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(origin)) {
        response.status(403).json({ error: 'TaskTape accepts only local MCP clients.' })
        return
      }
      next()
    })
    app.post('/mcp', async (request, response) => {
      const mcp = createTaskTapeMcpServer(this.options)
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
      })
      response.on('close', () => {
        void transport.close()
        void mcp.close()
      })
      try {
        await mcp.connect(transport)
        await transport.handleRequest(request, response, request.body)
      } catch (error) {
        if (!response.headersSent) {
          response.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : 'TaskTape MCP request failed.'
            },
            id: null
          })
        }
      }
    })
    app.get('/mcp', (_request, response) => response.status(405).set('Allow', 'POST').end())
    app.delete('/mcp', (_request, response) => response.status(405).set('Allow', 'POST').end())

    await new Promise<void>((resolvePromise, reject) => {
      const server = app.listen(this.options.port ?? TASKTAPE_MCP_DEFAULT_PORT, '127.0.0.1')
      server.once('listening', () => {
        const address = server.address()
        if (address && typeof address !== 'string') this.actualPort = address.port
        this.httpServer = server
        resolvePromise()
      })
      server.once('error', reject)
    })
    return this.status
  }

  async stop(): Promise<void> {
    const server = this.httpServer
    this.httpServer = null
    await this.options.manager.close()
    if (!server) return
    await new Promise<void>((resolvePromise, reject) => {
      server.close((error) => (error ? reject(error) : resolvePromise()))
    })
  }
}
