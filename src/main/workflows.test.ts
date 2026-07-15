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
  await writeFile(join(source, 'clip.mp4'), 'video')
  await writeFile(join(source, 'cover.JPG'), 'image')
  await writeFile(join(source, 'notes.txt'), 'notes')
  return {
    root: join(root, 'workflows'),
    source,
    input: {
      name: 'Organize creator media',
      goal: 'Sort new videos and images.',
      sourceDirectory: source,
      videoFolder: 'Videos',
      imageFolder: 'Images',
      operation,
      unmatchedPolicy: 'leave',
      unmatchedFolder: 'Unsorted'
    }
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('workflow persistence and execution', () => {
  it('saves a versioned local recipe and plans exact media changes without mutation', async () => {
    const setup = await fixture()
    const workflow = await saveWorkflow(setup.root, setup.input)
    const plan = await createWorkflowPlan(setup.root, workflow.id)

    expect(plan.actions.map((action) => action.category)).toEqual(['video', 'image'])
    expect(plan.skipped).toEqual([
      { path: join(setup.source, 'notes.txt'), reason: 'No matching media category.' }
    ])
    expect(await readFile(join(setup.source, 'clip.mp4'), 'utf8')).toBe('video')
    await expect(stat(join(setup.source, 'Videos'))).rejects.toMatchObject({ code: 'ENOENT' })
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
    expect(run.results).toHaveLength(2)
    expect(await readFile(join(setup.source, 'Videos', 'clip.mp4'), 'utf8')).toBe('video')
    expect(await readFile(join(setup.source, 'Images', 'cover.JPG'), 'utf8')).toBe('image')
    await expect(stat(join(setup.source, 'clip.mp4'))).rejects.toMatchObject({ code: 'ENOENT' })
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
    expect(await readFile(join(setup.source, 'clip.mp4'), 'utf8')).toBe('video')
    expect(await readFile(join(setup.source, 'Videos', 'clip.mp4'), 'utf8')).toBe('video')
  })

  it('skips collisions and rejects destination traversal', async () => {
    const setup = await fixture()
    await mkdir(join(setup.source, 'Videos'))
    await writeFile(join(setup.source, 'Videos', 'clip.mp4'), 'existing')
    const workflow = await saveWorkflow(setup.root, setup.input)
    const plan = await createWorkflowPlan(setup.root, workflow.id)

    expect(plan.actions.some((action) => action.sourcePath.endsWith('clip.mp4'))).toBe(false)
    expect(plan.skipped.some((item) => item.reason.includes('already exists'))).toBe(true)
    await expect(
      saveWorkflow(setup.root, { ...setup.input, videoFolder: '../outside' })
    ).rejects.toThrow('Use a single folder name without slashes.')
  })

  it('refuses an approved action when its source changes', async () => {
    const setup = await fixture()
    const workflow = await saveWorkflow(setup.root, setup.input)
    const plan = await createWorkflowPlan(setup.root, workflow.id)
    await writeFile(join(setup.source, 'clip.mp4'), 'changed video')
    const run = await executeWorkflowPlan(setup.root, {
      workflowId: workflow.id,
      planId: plan.id
    })

    expect(run.status).toBe('partial')
    expect(run.results.find((result) => result.sourcePath.endsWith('clip.mp4'))).toMatchObject({
      status: 'failed',
      message: 'The source file changed after review.'
    })
  })

  it('never overwrites a destination created after review', async () => {
    const setup = await fixture()
    const workflow = await saveWorkflow(setup.root, setup.input)
    const plan = await createWorkflowPlan(setup.root, workflow.id)
    await mkdir(join(setup.source, 'Videos'))
    await writeFile(join(setup.source, 'Videos', 'clip.mp4'), 'new destination')
    const run = await executeWorkflowPlan(setup.root, {
      workflowId: workflow.id,
      planId: plan.id
    })

    expect(run.status).toBe('partial')
    expect(await readFile(join(setup.source, 'Videos', 'clip.mp4'), 'utf8')).toBe('new destination')
    expect(await readFile(join(setup.source, 'clip.mp4'), 'utf8')).toBe('video')
  })

  it('does not persist a workflow for a missing source folder', async () => {
    const setup = await fixture()
    await expect(
      saveWorkflow(setup.root, {
        ...setup.input,
        sourceDirectory: join(setup.source, 'missing')
      })
    ).rejects.toThrow('That media folder is no longer available. Choose it again.')
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
    expect(await readFile(join(setup.source, 'Videos', 'clip.mp4'), 'utf8')).toBe('video')

    const history = await listWorkflowHistory(setup.root)
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      workflowName: 'Organize creator media',
      run: { trigger: 'schedule', status: 'completed' }
    })
  })
})
