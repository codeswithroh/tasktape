import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'
import { rm } from 'node:fs/promises'

import type { SaveWorkflowInput } from '../shared/workflow-schema.js'
import { createWorkflowPlan, executeWorkflowPlan, saveWorkflow } from './workflows.js'

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
})
