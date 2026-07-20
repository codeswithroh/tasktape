import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { bugSessionSchema } from '../shared/agent-schema.js'
import {
  compileIssueReport,
  compilePlaywrightSpec,
  findSessionForWorkflow,
  readAgentEvidence
} from './agent-artifacts.js'

const SESSION_ID = '11111111-1111-4111-8111-111111111111'
const WORKFLOW_ID = '22222222-2222-4222-8222-222222222222'

function sessionFixture() {
  return bugSessionSchema.parse({
    version: 1,
    id: SESSION_ID,
    name: 'Category stays selected',
    url: 'http://127.0.0.1:4173/',
    expectedOutcome: 'Launch clip keeps the Video category.',
    issueContext: 'The category changes after Save.',
    status: 'completed',
    createdAt: '2026-07-20T00:00:00.000Z',
    completedAt: '2026-07-20T00:01:00.000Z',
    actions: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        type: 'select_option',
        summary: 'Choose "Video" in the field labeled "Category".',
        createdAt: '2026-07-20T00:00:10.000Z',
        screenshotFile: 'screenshots/001-select-option.png',
        command: { type: 'select_option', selector: { label: 'Category' }, value: 'Video' }
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        type: 'click',
        summary: 'Click the button named "Save asset".',
        createdAt: '2026-07-20T00:00:20.000Z',
        screenshotFile: 'screenshots/002-click.png',
        command: { type: 'click', selector: { role: 'button', name: 'Save asset' } }
      }
    ],
    console: [
      {
        type: 'error',
        summary: 'Category reset to Uncategorized',
        createdAt: '2026-07-20T00:00:21.000Z'
      }
    ],
    network: [],
    initialScreenshotFile: 'screenshots/000-initial.png',
    finalScreenshotFile: 'screenshots/final.png',
    traceFile: 'trace.zip',
    replayInstructions: 'Choose Video and save.',
    workflowId: WORKFLOW_ID
  })
}

describe('agent artifacts', () => {
  it('exports structured actions as reviewable Playwright code', () => {
    const source = compilePlaywrightSpec(sessionFixture())

    expect(source).toContain('page.getByLabel("Category").selectOption("Video")')
    expect(source).toContain(
      'page.getByRole("button", { name: "Save asset", exact: true }).click()'
    )
    expect(source).toContain('toHaveScreenshot("category-stays-selected.png"')
    expect(source).toContain('TASKTAPE_BASE_URL')
  })

  it('builds a ticket-ready report with steps and diagnostics', () => {
    const report = compileIssueReport(sessionFixture())

    expect(report).toContain('## Reproduction steps')
    expect(report).toContain('Launch clip keeps the Video category.')
    expect(report).toContain('Category reset to Uncategorized')
    expect(report).toContain('trace.zip')
  })

  it('asks users to recapture sessions without structured replay commands', () => {
    const legacySession = sessionFixture()
    legacySession.actions[0].command = null

    expect(() => compilePlaywrightSpec(legacySession)).toThrow(
      'This check predates portable action capture. Record it again to export Playwright code.'
    )
  })

  it('finds persisted evidence and reports portable artifact availability', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tasktape-artifacts-'))
    const directory = join(root, SESSION_ID)
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'session.json'), JSON.stringify(sessionFixture()))
    await writeFile(join(directory, 'trace.zip'), 'trace')

    const found = await findSessionForWorkflow(root, WORKFLOW_ID)
    const summary = await readAgentEvidence(root, WORKFLOW_ID)

    expect(found?.session.id).toBe(SESSION_ID)
    expect(summary).toMatchObject({
      workflowId: WORKFLOW_ID,
      actionCount: 2,
      screenshotCount: 4,
      consoleCount: 1,
      hasTrace: true,
      canExportPlaywright: true
    })
  })
})
