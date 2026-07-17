import { mkdtemp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'
import { rm } from 'node:fs/promises'

import type { SaveWorkflowInput } from '../shared/workflow-schema.js'
import {
  createWorkflowPlan,
  executeWorkflowPlan,
  listWorkflowHistory,
  nextScheduleTime,
  runDueSchedules,
  saveWorkflow,
  saveWorkflowSchedule
} from './workflows.js'

const roots: string[] = []

async function fixture(operation: 'move' | 'copy' = 'move'): Promise<{
  root: string
  source: string
  input: SaveWorkflowInput
}> {
  const root = await mkdtemp(join(tmpdir(), 'tasktape-workflow-'))
  roots.push(root)
  const source = join(root, 'inbox')
  await mkdir(source)
  await writeFile(join(source, 'contract.PDF'), 'document')
  await writeFile(join(source, 'expenses.CSV'), 'sheet')
  await writeFile(join(source, 'archive.ZIP'), 'archive')
  await writeFile(join(source, 'notes.txt'), 'notes')
  return {
    root: join(root, 'workflows'),
    source,
    input: {
      name: 'Organize project assets',
      goal: 'Sort incoming assets by their learned file groups.',
      capability: 'organize_files',
      sourceDirectory: source,
      operation,
      rules: [
        {
          id: 'project_docs',
          label: 'Project documents',
          extensions: ['.pdf', '.csv'],
          destinationFolder: 'Project Docs'
        },
        {
          id: 'archives',
          label: 'Archives',
          extensions: ['.zip', '.tar'],
          destinationFolder: 'Archives'
        }
      ],
      unmatchedPolicy: 'leave',
      unmatchedFolder: null
    }
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('workflow persistence and execution', () => {
  it('saves a versioned local recipe and plans arbitrary learned extension groups without mutation', async () => {
    const setup = await fixture()
    const workflow = await saveWorkflow(setup.root, setup.input)
    const plan = await createWorkflowPlan(setup.root, workflow.id)

    expect(workflow.version).toBe(2)
    expect(plan.actions.map((action) => action.category)).toEqual([
      'Archives',
      'Project documents',
      'Project documents'
    ])
    expect(plan.skipped).toEqual([
      { path: join(setup.source, 'notes.txt'), reason: 'No learned rule matches this file type.' }
    ])
    expect(await readFile(join(setup.source, 'contract.PDF'), 'utf8')).toBe('document')
    await expect(stat(join(setup.source, 'Project Docs'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('moves approved files on disk and records the real result', async () => {
    const setup = await fixture('move')
    const workflow = await saveWorkflow(setup.root, setup.input)
    const plan = await createWorkflowPlan(setup.root, workflow.id)
    const run = await executeWorkflowPlan(setup.root, {
      workflowId: workflow.id,
      planId: plan.id
    })

    expect(run.status).toBe('completed')
    expect(run.results).toHaveLength(3)
    expect(await readFile(join(setup.source, 'Project Docs', 'contract.PDF'), 'utf8')).toBe(
      'document'
    )
    expect(await readFile(join(setup.source, 'Archives', 'archive.ZIP'), 'utf8')).toBe('archive')
    await expect(stat(join(setup.source, 'contract.PDF'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(join(setup.source, 'notes.txt'), 'utf8')).toBe('notes')
  })

  it('copies files and keeps the originals', async () => {
    const setup = await fixture('copy')
    const workflow = await saveWorkflow(setup.root, setup.input)
    const plan = await createWorkflowPlan(setup.root, workflow.id)
    const run = await executeWorkflowPlan(setup.root, {
      workflowId: workflow.id,
      planId: plan.id
    })

    expect(run.status).toBe('completed')
    expect(await readFile(join(setup.source, 'contract.PDF'), 'utf8')).toBe('document')
    expect(await readFile(join(setup.source, 'Project Docs', 'contract.PDF'), 'utf8')).toBe(
      'document'
    )
  })

  it('skips collisions and rejects destination traversal', async () => {
    const setup = await fixture()
    await mkdir(join(setup.source, 'Project Docs'))
    await writeFile(join(setup.source, 'Project Docs', 'contract.PDF'), 'existing')
    const workflow = await saveWorkflow(setup.root, setup.input)
    const plan = await createWorkflowPlan(setup.root, workflow.id)

    expect(plan.actions.some((action) => action.sourcePath.endsWith('contract.PDF'))).toBe(false)
    expect(plan.skipped.some((item) => item.reason.includes('already exists'))).toBe(true)
    await expect(
      saveWorkflow(setup.root, {
        ...setup.input,
        rules: [{ ...setup.input.rules[0], destinationFolder: '../outside' }]
      })
    ).rejects.toThrow('Use a single folder name without slashes.')
  })

  it('refuses an approved action when its source changes', async () => {
    const setup = await fixture()
    const workflow = await saveWorkflow(setup.root, setup.input)
    const plan = await createWorkflowPlan(setup.root, workflow.id)
    await writeFile(join(setup.source, 'contract.PDF'), 'changed document')
    const run = await executeWorkflowPlan(setup.root, {
      workflowId: workflow.id,
      planId: plan.id
    })

    expect(run.status).toBe('partial')
    expect(run.results.find((result) => result.sourcePath.endsWith('contract.PDF'))).toMatchObject({
      status: 'failed',
      message: 'The source file changed after review.'
    })
  })

  it('never overwrites a destination created after review', async () => {
    const setup = await fixture()
    const workflow = await saveWorkflow(setup.root, setup.input)
    const plan = await createWorkflowPlan(setup.root, workflow.id)
    await mkdir(join(setup.source, 'Project Docs'))
    await writeFile(join(setup.source, 'Project Docs', 'contract.PDF'), 'new destination')
    const run = await executeWorkflowPlan(setup.root, {
      workflowId: workflow.id,
      planId: plan.id
    })

    expect(run.status).toBe('partial')
    expect(await readFile(join(setup.source, 'Project Docs', 'contract.PDF'), 'utf8')).toBe(
      'new destination'
    )
    expect(await readFile(join(setup.source, 'contract.PDF'), 'utf8')).toBe('document')
  })

  it('does not persist a workflow for a missing source folder', async () => {
    const setup = await fixture()
    await expect(
      saveWorkflow(setup.root, {
        ...setup.input,
        sourceDirectory: join(setup.source, 'missing')
      })
    ).rejects.toThrow('That source folder is no longer available. Choose it again.')
    await expect(readdir(setup.root)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('calculates the next daily and weekly times in local time', () => {
    const mondayMorning = new Date(2026, 0, 5, 10, 30)

    expect(
      nextScheduleTime(
        { workflowId: crypto.randomUUID(), frequency: 'daily', time: '09:15', weekday: null },
        mondayMorning
      )
    ).toEqual(new Date(2026, 0, 6, 9, 15))
    expect(
      nextScheduleTime(
        { workflowId: crypto.randomUUID(), frequency: 'weekly', time: '11:00', weekday: 3 },
        mondayMorning
      )
    ).toEqual(new Date(2026, 0, 7, 11, 0))
  })

  it('persists a schedule, runs it when due, and adds it to history', async () => {
    const setup = await fixture('move')
    const workflow = await saveWorkflow(setup.root, setup.input)
    const now = new Date(2026, 0, 5, 10, 30)
    const schedule = await saveWorkflowSchedule(
      setup.root,
      { workflowId: workflow.id, frequency: 'daily', time: '10:31', weekday: null },
      now
    )

    expect(schedule.enabled).toBe(true)
    expect(schedule.nextRunAt).toBe(new Date(2026, 0, 5, 10, 31).toISOString())

    const earlyRuns = await runDueSchedules(setup.root, new Date(2026, 0, 5, 10, 30, 59))
    expect(earlyRuns).toEqual([])

    const runs = await runDueSchedules(setup.root, new Date(schedule.nextRunAt))
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ status: 'completed', trigger: 'schedule' })
    expect(await readFile(join(setup.source, 'Project Docs', 'contract.PDF'), 'utf8')).toBe(
      'document'
    )

    const history = await listWorkflowHistory(setup.root)
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      workflowName: 'Organize project assets',
      run: { trigger: 'schedule', status: 'completed' }
    })
  })

  it('migrates a saved version 1 workflow before planning and preserves existing files', async () => {
    const setup = await fixture()
    const workflowId = crypto.randomUUID()
    const workflowDirectory = join(setup.root, workflowId)
    await mkdir(join(workflowDirectory, 'plans'), { recursive: true })
    await mkdir(join(workflowDirectory, 'runs'), { recursive: true })
    await writeFile(join(setup.source, 'legacy.mp4'), 'legacy video')
    await writeFile(join(setup.source, 'legacy.png'), 'legacy image')
    const timestamp = new Date(2026, 0, 1).toISOString()
    const planId = crypto.randomUUID()
    const runId = crypto.randomUUID()
    const legacySchedule = {
      version: 1,
      workflowId,
      frequency: 'weekly',
      time: '09:00',
      weekday: 1,
      enabled: true,
      nextRunAt: new Date(2026, 0, 5, 9).toISOString(),
      createdAt: timestamp,
      updatedAt: timestamp
    }
    await writeFile(
      join(workflowDirectory, 'workflow.json'),
      JSON.stringify({
        version: 1,
        id: workflowId,
        name: 'Legacy media workflow',
        goal: 'Keep the existing recipe working.',
        sourceDirectory: setup.source,
        videoFolder: 'Legacy Videos',
        imageFolder: 'Legacy Images',
        operation: 'copy',
        unmatchedPolicy: 'leave',
        unmatchedFolder: 'Legacy Unsorted',
        createdAt: timestamp,
        updatedAt: timestamp
      })
    )
    await writeFile(join(workflowDirectory, 'schedule.json'), JSON.stringify(legacySchedule))
    await writeFile(
      join(workflowDirectory, 'runs', `${runId}.json`),
      JSON.stringify({
        version: 1,
        id: runId,
        workflowId,
        planId,
        startedAt: timestamp,
        completedAt: timestamp,
        status: 'completed',
        trigger: 'schedule',
        results: []
      })
    )

    const plan = await createWorkflowPlan(setup.root, workflowId)
    const history = await listWorkflowHistory(setup.root)
    const persisted = JSON.parse(await readFile(join(workflowDirectory, 'workflow.json'), 'utf8'))

    expect(persisted).toMatchObject({
      version: 2,
      id: workflowId,
      capability: 'organize_files',
      operation: 'copy',
      unmatchedPolicy: 'leave',
      unmatchedFolder: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      rules: [
        { id: 'video_files', label: 'Video files', destinationFolder: 'Legacy Videos' },
        { id: 'image_files', label: 'Image files', destinationFolder: 'Legacy Images' }
      ]
    })
    expect(plan.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'Video files',
          sourcePath: join(setup.source, 'legacy.mp4'),
          destinationPath: join(setup.source, 'Legacy Videos', 'legacy.mp4')
        }),
        expect.objectContaining({
          category: 'Image files',
          sourcePath: join(setup.source, 'legacy.png'),
          destinationPath: join(setup.source, 'Legacy Images', 'legacy.png')
        })
      ])
    )
    expect(await readFile(join(setup.source, 'legacy.mp4'), 'utf8')).toBe('legacy video')
    expect(await readFile(join(setup.source, 'legacy.png'), 'utf8')).toBe('legacy image')
    expect(JSON.parse(await readFile(join(workflowDirectory, 'schedule.json'), 'utf8'))).toEqual(
      legacySchedule
    )
    expect(history).toEqual([
      expect.objectContaining({
        workflowName: 'Legacy media workflow',
        workflowGoal: 'Keep the existing recipe working.',
        run: expect.objectContaining({ id: runId, trigger: 'schedule', status: 'completed' })
      })
    ])
  })

  it('moves unmatched files only when a destination is configured', async () => {
    const setup = await fixture()
    const workflow = await saveWorkflow(setup.root, {
      ...setup.input,
      unmatchedPolicy: 'move',
      unmatchedFolder: 'Needs Review'
    })
    const plan = await createWorkflowPlan(setup.root, workflow.id)

    expect(plan.actions.find((action) => action.sourcePath.endsWith('notes.txt'))).toMatchObject({
      category: 'Unmatched files',
      destinationPath: join(setup.source, 'Needs Review', 'notes.txt')
    })
    expect(plan.skipped).toEqual([])
  })
})
