import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  chromium,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page
} from 'playwright-core'

import {
  addSessionNoteInputSchema,
  agentActionSchema,
  browserSelectorSchema,
  bugSessionSchema,
  clickInputSchema,
  fillInputSchema,
  finishBugSessionInputSchema,
  pressKeyInputSchema,
  selectOptionInputSchema,
  startBugSessionInputSchema,
  waitForInputSchema,
  type BrowserSelector,
  type BugSession,
  type AgentReplayCommand,
  type StartBugSessionInput
} from '../shared/agent-schema.js'
import type { SavedWorkflow } from '../shared/workflow-schema.js'

const MAX_ACTIONS = 100
const MAX_LOGS = 500

interface BrowserEvidenceSession {
  browser: Browser
  context: BrowserContext
  page: Page
  directory: string
  data: BugSession
}

export interface BrowserObservation {
  sessionId: string
  title: string
  url: string
  accessibility: string
  screenshot: Buffer
}

export interface FinishedBugSession {
  session: BugSession
  workflow: SavedWorkflow
  directory: string
}

export interface BrowserEvidenceManagerOptions {
  sessionsRoot: string
  saveComputerWorkflow: (input: {
    name: string
    goal: string
    instructions: string
    approvalMode: 'review_each_run'
    capability: 'computer'
    targetApp: string
    expectedOutcome: string
  }) => Promise<SavedWorkflow>
  launchBrowser?: () => Promise<Browser>
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  await rename(temporary, path)
}

export function bundledChromiumExecutable(
  resourcesPath = process.resourcesPath,
  architecture = process.arch
): string | undefined {
  const root = join(resourcesPath, 'playwright-browsers')
  if (!existsSync(root)) return undefined

  const platformDirectory = architecture === 'arm64' ? 'chrome-mac-arm64' : 'chrome-mac-x64'
  const revisions = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('chromium-'))
    .map((entry) => entry.name)
    .sort()
    .reverse()

  return revisions
    .map((revision) =>
      join(
        root,
        revision,
        platformDirectory,
        'Google Chrome for Testing.app',
        'Contents',
        'MacOS',
        'Google Chrome for Testing'
      )
    )
    .find((candidate) => existsSync(candidate))
}

function localChromeExecutable(): string | undefined {
  const configured = process.env.TASKTAPE_CHROMIUM_EXECUTABLE
  if (configured && existsSync(configured)) return configured

  const candidates = [
    bundledChromiumExecutable(),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    chromium.executablePath()
  ]
  return candidates.find((candidate): candidate is string =>
    Boolean(candidate && existsSync(candidate))
  )
}

export async function launchTaskTapeBrowser(): Promise<Browser> {
  const executablePath = localChromeExecutable()
  if (!executablePath) {
    throw new Error(
      'TaskTape could not start its browser. Reinstall TaskTape, or choose a Chrome executable with TASKTAPE_CHROMIUM_EXECUTABLE.'
    )
  }
  return chromium.launch({
    executablePath,
    headless: false,
    args: ['--no-first-run', '--no-default-browser-check']
  })
}

function selectorSummary(selector: BrowserSelector): string {
  if (selector.role) {
    return `${selector.role}${selector.name ? ` named "${selector.name}"` : ''}`
  }
  if (selector.label) return `field labeled "${selector.label}"`
  if (selector.text) return `text "${selector.text}"`
  return `element ${selector.css}`
}

function resolveLocator(page: Page, rawSelector: BrowserSelector): Locator {
  const selector = browserSelectorSchema.parse(rawSelector)
  if (selector.role) {
    return page.getByRole(selector.role as Parameters<Page['getByRole']>[0], {
      name: selector.name,
      exact: Boolean(selector.name)
    })
  }
  if (selector.label) return page.getByLabel(selector.label)
  if (selector.text) return page.getByText(selector.text, { exact: true })
  return page.locator(selector.css ?? '')
}

function compactLog(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 1_000) || 'No details provided.'
}

export function compileReplayInstructions(session: BugSession): string {
  const executableActions = session.actions.filter((action) => action.type !== 'note')
  const steps = executableActions.map((action, index) => `${index + 1}. ${action.summary}`)
  const context = session.issueContext ? `Context from the issue: ${session.issueContext}\n\n` : ''
  const body = steps.length > 0 ? steps.join('\n') : '1. Inspect the page without changing it.'
  return `${context}Open ${session.url} in Google Chrome. Then reproduce these steps:\n${body}\nStop as soon as the expected result can be evaluated.`.slice(
    0,
    2_000
  )
}

export class BrowserEvidenceManager {
  private active: BrowserEvidenceSession | null = null
  private readonly launchBrowser: () => Promise<Browser>

  constructor(private readonly options: BrowserEvidenceManagerOptions) {
    this.launchBrowser = options.launchBrowser ?? launchTaskTapeBrowser
  }

  get activeSession(): BugSession | null {
    return this.active?.data ?? null
  }

  async start(rawInput: StartBugSessionInput): Promise<BrowserObservation> {
    if (this.active) throw new Error('Finish the active bug session before starting another one.')
    const input = startBugSessionInputSchema.parse(rawInput)
    const id = randomUUID()
    const directory = join(this.options.sessionsRoot, id)
    await mkdir(join(directory, 'screenshots'), { recursive: true })

    const browser = await this.launchBrowser()
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      acceptDownloads: false
    })
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
    const page = await context.newPage()
    const now = new Date().toISOString()
    const data = bugSessionSchema.parse({
      version: 1,
      id,
      ...input,
      status: 'active',
      createdAt: now,
      completedAt: null,
      actions: [],
      console: [],
      network: [],
      initialScreenshotFile: 'screenshots/000-initial.png',
      finalScreenshotFile: null,
      traceFile: 'trace.zip',
      replayInstructions: null,
      workflowId: null
    })
    this.active = { browser, context, page, directory, data }
    this.attachLogs(this.active)

    try {
      await page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      await page.screenshot({ path: join(directory, data.initialScreenshotFile), fullPage: false })
      await this.persist()
      return this.observe()
    } catch (error) {
      await this.abandon()
      throw error
    }
  }

  async observe(): Promise<BrowserObservation> {
    const session = this.requireActive()
    const screenshot = await session.page.screenshot({ type: 'png', fullPage: false })
    const accessibility = compactLog(
      await session.page
        .locator('body')
        .ariaSnapshot({ timeout: 5_000 })
        .catch(() => 'The page accessibility snapshot is unavailable.')
    )
    return {
      sessionId: session.data.id,
      title: await session.page.title(),
      url: session.page.url(),
      accessibility: accessibility.slice(0, 8_000),
      screenshot
    }
  }

  async click(rawInput: unknown): Promise<BrowserObservation> {
    const input = clickInputSchema.parse(rawInput)
    const session = this.requireActive()
    const summary = `Click the ${selectorSummary(input.selector)}.`
    await resolveLocator(session.page, input.selector).click({ timeout: 10_000 })
    await this.recordAction('click', summary, {
      command: { type: 'click', selector: input.selector }
    })
    return this.observe()
  }

  async fill(rawInput: unknown): Promise<BrowserObservation> {
    const input = fillInputSchema.parse(rawInput)
    const session = this.requireActive()
    const locator = resolveLocator(session.page, input.selector)
    const inputType = await locator.getAttribute('type')
    if (inputType?.toLowerCase() === 'password') {
      throw new Error('TaskTape does not record or fill password fields.')
    }
    await locator.fill(input.value, { timeout: 10_000 })
    const displayedValue =
      input.value.length > 120 ? `${input.value.slice(0, 117)}...` : input.value
    await this.recordAction(
      'fill',
      `Fill the ${selectorSummary(input.selector)} with "${displayedValue}".`,
      {
        command: { type: 'fill', selector: input.selector, value: input.value }
      }
    )
    return this.observe()
  }

  async selectOption(rawInput: unknown): Promise<BrowserObservation> {
    const input = selectOptionInputSchema.parse(rawInput)
    const session = this.requireActive()
    await resolveLocator(session.page, input.selector).selectOption(input.value, {
      timeout: 10_000
    })
    await this.recordAction(
      'select_option',
      `Choose "${input.value}" in the ${selectorSummary(input.selector)}.`,
      { command: { type: 'select_option', selector: input.selector, value: input.value } }
    )
    return this.observe()
  }

  async pressKey(rawInput: unknown): Promise<BrowserObservation> {
    const input = pressKeyInputSchema.parse(rawInput)
    const session = this.requireActive()
    await session.page.keyboard.press(input.key)
    await this.recordAction('press_key', `Press ${input.key}.`, {
      command: { type: 'press_key', key: input.key }
    })
    return this.observe()
  }

  async waitFor(rawInput: unknown): Promise<BrowserObservation> {
    const input = waitForInputSchema.parse(rawInput)
    const session = this.requireActive()
    if (input.text) {
      await session.page.getByText(input.text, { exact: false }).first().waitFor({
        state: 'visible',
        timeout: 10_000
      })
      await this.recordAction('wait_for', `Wait until "${input.text}" is visible.`, {
        command: { type: 'wait_for', text: input.text }
      })
    } else {
      await session.page.waitForTimeout(input.milliseconds ?? 100)
      await this.recordAction('wait_for', `Wait ${input.milliseconds} milliseconds.`, {
        command: { type: 'wait_for', milliseconds: input.milliseconds }
      })
    }
    return this.observe()
  }

  async addNote(rawInput: unknown): Promise<BugSession> {
    const input = addSessionNoteInputSchema.parse(rawInput)
    await this.recordAction('note', `Agent note: ${input.note}`, { screenshot: false })
    return this.requireActive().data
  }

  async finish(rawInput: unknown = {}): Promise<FinishedBugSession> {
    const input = finishBugSessionInputSchema.parse(rawInput)
    const session = this.requireActive()
    const finalScreenshotFile = 'screenshots/final.png'
    await session.page.screenshot({
      path: join(session.directory, finalScreenshotFile),
      fullPage: false
    })
    await session.context.tracing.stop({ path: join(session.directory, session.data.traceFile) })

    const instructions = input.replayInstructions || compileReplayInstructions(session.data)
    const workflow = await this.options.saveComputerWorkflow({
      name: session.data.name,
      goal: `Verify: ${session.data.expectedOutcome}`.slice(0, 240),
      instructions,
      approvalMode: 'review_each_run',
      capability: 'computer',
      targetApp: 'Google Chrome',
      expectedOutcome: session.data.expectedOutcome
    })
    session.data = bugSessionSchema.parse({
      ...session.data,
      status: 'completed',
      completedAt: new Date().toISOString(),
      finalScreenshotFile,
      replayInstructions: instructions,
      workflowId: workflow.id
    })
    await this.persist()
    await session.browser.close()
    this.active = null
    return { session: session.data, workflow, directory: session.directory }
  }

  async close(): Promise<void> {
    if (this.active) await this.abandon()
  }

  private requireActive(): BrowserEvidenceSession {
    if (!this.active) throw new Error('Start a bug session first.')
    return this.active
  }

  private attachLogs(session: BrowserEvidenceSession): void {
    session.page.on('console', (message) => {
      this.appendLog('console', message.type(), message.text())
    })
    session.page.on('pageerror', (error) => {
      this.appendLog('console', 'pageerror', error.message)
    })
    session.page.on('requestfailed', (request) => {
      this.appendLog(
        'network',
        'requestfailed',
        `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`
      )
    })
    session.page.on('response', (response) => {
      if (response.status() >= 400) {
        this.appendLog(
          'network',
          `http-${response.status()}`,
          `${response.request().method()} ${response.url()}`
        )
      }
    })
  }

  private appendLog(target: 'console' | 'network', type: string, summary: string): void {
    if (!this.active || this.active.data[target].length >= MAX_LOGS) return
    this.active.data[target].push({
      type: compactLog(type).slice(0, 40),
      summary: compactLog(summary),
      createdAt: new Date().toISOString()
    })
    void this.persist().catch(() => undefined)
  }

  private async recordAction(
    type: BugSession['actions'][number]['type'],
    summary: string,
    options: { screenshot?: boolean; command?: AgentReplayCommand } = {}
  ): Promise<void> {
    const session = this.requireActive()
    if (session.data.actions.length >= MAX_ACTIONS) {
      throw new Error('This session reached the 100-action limit. Finish it before continuing.')
    }
    const index = session.data.actions.length + 1
    const screenshotFile =
      (options.screenshot ?? true)
        ? `screenshots/${String(index).padStart(3, '0')}-${type.replace('_', '-')}.png`
        : null
    if (screenshotFile) {
      await session.page.screenshot({
        path: join(session.directory, screenshotFile),
        fullPage: false
      })
    }
    session.data.actions.push(
      agentActionSchema.parse({
        id: randomUUID(),
        type,
        summary,
        createdAt: new Date().toISOString(),
        screenshotFile,
        command: options.command ?? null
      })
    )
    await this.persist()
  }

  private async persist(): Promise<void> {
    if (!this.active) return
    await writeJson(
      join(this.active.directory, 'session.json'),
      bugSessionSchema.parse(this.active.data)
    )
  }

  private async abandon(): Promise<void> {
    const session = this.active
    if (!session) return
    session.data = bugSessionSchema.parse({
      ...session.data,
      status: 'abandoned',
      completedAt: new Date().toISOString()
    })
    await this.persist().catch(() => undefined)
    await session.context.tracing
      .stop({ path: join(session.directory, session.data.traceFile) })
      .catch(() => undefined)
    await session.browser.close().catch(() => undefined)
    this.active = null
  }
}
