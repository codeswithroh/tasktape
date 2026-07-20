import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import {
  agentEvidenceSummarySchema,
  bugSessionSchema,
  type AgentEvidenceSummary,
  type AgentReplayCommand,
  type BrowserSelector,
  type BugSession
} from '../shared/agent-schema.js'

function quoted(value: string): string {
  return JSON.stringify(value)
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'tasktape-replay'
  )
}

function locatorSource(selector: BrowserSelector): string {
  if (selector.role) {
    const options = selector.name ? `, { name: ${quoted(selector.name)}, exact: true }` : ''
    return `page.getByRole(${quoted(selector.role)}${options})`
  }
  if (selector.label) return `page.getByLabel(${quoted(selector.label)})`
  if (selector.text) return `page.getByText(${quoted(selector.text)}, { exact: true })`
  return `page.locator(${quoted(selector.css ?? '')})`
}

function commandSource(command: AgentReplayCommand): string {
  switch (command.type) {
    case 'click':
      return `await ${locatorSource(command.selector)}.click()`
    case 'fill':
      return `await ${locatorSource(command.selector)}.fill(${quoted(command.value)})`
    case 'select_option':
      return `await ${locatorSource(command.selector)}.selectOption(${quoted(command.value)})`
    case 'press_key':
      return `await page.keyboard.press(${quoted(command.key)})`
    case 'wait_for':
      return command.text
        ? `await expect(page.getByText(${quoted(command.text)}, { exact: false }).first()).toBeVisible()`
        : `await page.waitForTimeout(${command.milliseconds ?? 100})`
  }
}

export function playwrightFileName(session: BugSession): string {
  return `${slug(session.name)}.spec.ts`
}

export function compilePlaywrightSpec(session: BugSession): string {
  const commands = session.actions
    .filter((action) => action.type !== 'note')
    .map((action) => action.command)

  if (commands.length === 0 || commands.some((command) => command === null)) {
    throw new Error(
      'This check predates portable action capture. Record it again to export Playwright code.'
    )
  }

  const portableCommands = commands.filter(
    (command): command is AgentReplayCommand => command !== null
  )
  const steps = portableCommands.map((command) => `  ${commandSource(command)}`).join('\n')
  const screenshotName = `${slug(session.name)}.png`
  const expectedOutcome = session.expectedOutcome.replace(/[\r\n\u2028\u2029]+/g, ' ')
  return (
    `import { expect, test } from '@playwright/test'\n\n` +
    `test(${quoted(session.name)}, async ({ page }) => {\n` +
    `  const targetUrl = process.env.TASKTAPE_BASE_URL ?? ${quoted(session.url)}\n` +
    `  await page.goto(targetUrl)\n\n` +
    `${steps}\n\n` +
    `  // Expected result: ${expectedOutcome}\n` +
    `  // Review once, then create the baseline with: npx playwright test --update-snapshots\n` +
    `  await expect(page).toHaveScreenshot(${quoted(screenshotName)}, { fullPage: true })\n` +
    `})\n`
  )
}

export function compileIssueReport(session: BugSession): string {
  const steps = session.actions
    .filter((action) => action.type !== 'note')
    .map((action, index) => `${index + 1}. ${action.summary}`)
  const notes = session.actions
    .filter((action) => action.type === 'note')
    .map((action) => `- ${action.summary.replace(/^Agent note:\s*/, '')}`)
  const consoleEvents = session.console.map((entry) => `- ${entry.type}: ${entry.summary}`)
  const networkEvents = session.network.map((entry) => `- ${entry.type}: ${entry.summary}`)

  return [
    `# ${session.name}`,
    '',
    '## What happened',
    '',
    session.issueContext || 'The recorded browser flow did not produce the expected result.',
    '',
    '## Expected result',
    '',
    session.expectedOutcome,
    '',
    '## Reproduction steps',
    '',
    ...(steps.length ? steps : ['1. Open the recorded page and inspect the current state.']),
    ...(notes.length ? ['', '## Observations', '', ...notes] : []),
    ...(consoleEvents.length ? ['', '## Console', '', ...consoleEvents] : []),
    ...(networkEvents.length ? ['', '## Network', '', ...networkEvents] : []),
    '',
    '## Evidence',
    '',
    `- Local URL: ${session.url}`,
    `- Recorded actions: ${session.actions.filter((action) => action.type !== 'note').length}`,
    `- Trace: ${session.traceFile}`,
    `- Final screenshot: ${session.finalScreenshotFile ?? 'Not captured'}`,
    '',
    '_Captured locally with TaskTape Replay._',
    ''
  ].join('\n')
}

export async function findSessionForWorkflow(
  sessionsRoot: string,
  workflowId: string
): Promise<{ session: BugSession; directory: string } | null> {
  if (!existsSync(sessionsRoot)) return null
  const directories = (await readdir(sessionsRoot, { withFileTypes: true })).filter((entry) =>
    entry.isDirectory()
  )
  const matches: Array<{ session: BugSession; directory: string }> = []

  for (const entry of directories) {
    const directory = join(sessionsRoot, entry.name)
    try {
      const session = bugSessionSchema.parse(
        JSON.parse(await readFile(join(directory, 'session.json'), 'utf8'))
      )
      if (session.workflowId === workflowId && session.status === 'completed') {
        matches.push({ session, directory })
      }
    } catch {
      // Ignore unrelated or incomplete local session folders.
    }
  }

  return (
    matches.sort((left, right) =>
      (right.session.completedAt ?? '').localeCompare(left.session.completedAt ?? '')
    )[0] ?? null
  )
}

export async function readAgentEvidence(
  sessionsRoot: string,
  workflowId: string
): Promise<AgentEvidenceSummary | null> {
  const match = await findSessionForWorkflow(sessionsRoot, workflowId)
  if (!match) return null
  const { session, directory } = match
  const executableActions = session.actions.filter((action) => action.type !== 'note')
  const screenshotFiles = new Set(
    [
      session.initialScreenshotFile,
      session.finalScreenshotFile,
      ...session.actions.map((action) => action.screenshotFile)
    ].filter((file): file is string => Boolean(file))
  )

  return agentEvidenceSummarySchema.parse({
    workflowId,
    sessionId: session.id,
    url: session.url,
    actionCount: executableActions.length,
    screenshotCount: screenshotFiles.size,
    consoleCount: session.console.length,
    networkCount: session.network.length,
    hasTrace: existsSync(join(directory, session.traceFile)),
    canExportPlaywright:
      executableActions.length > 0 && executableActions.every((action) => action.command !== null)
  })
}
