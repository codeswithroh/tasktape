import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile
} from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'

import {
  executeWorkflowInputSchema,
  type SavedWorkflow,
  type SaveWorkflowInput,
  savedWorkflowSchema,
  saveWorkflowInputSchema,
  type WorkflowPlan,
  workflowPlanSchema,
  type WorkflowRun,
  workflowRunSchema,
  workflowIdSchema,
  type SaveScheduleInput,
  saveScheduleInputSchema,
  type WorkflowSchedule,
  workflowScheduleSchema,
  type WorkflowHistoryEntry,
  workflowHistoryEntrySchema
} from '../shared/workflow-schema.js'

const VIDEO_EXTENSIONS = new Set(['.avi', '.m4v', '.mkv', '.mov', '.mp4', '.webm'])
const IMAGE_EXTENSIONS = new Set(['.gif', '.heic', '.jpeg', '.jpg', '.png', '.raw', '.webp'])

async function writeJson(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.${randomUUID()}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  await rename(temporaryPath, path)
}

function workflowDirectory(root: string, workflowId: string): string {
  return join(root, workflowId)
}

async function readWorkflow(root: string, workflowId: string): Promise<SavedWorkflow> {
  const id = workflowIdSchema.parse(workflowId)
  const content = await readFile(join(workflowDirectory(root, id), 'workflow.json'), 'utf8')
  return savedWorkflowSchema.parse(JSON.parse(content))
}

export async function saveWorkflow(
  root: string,
  rawInput: SaveWorkflowInput,
  existingId?: string
): Promise<SavedWorkflow> {
  const input = saveWorkflowInputSchema.parse(rawInput)
  const sourceInfo = await stat(input.sourceDirectory).catch(() => null)
  if (!sourceInfo?.isDirectory()) {
    throw new Error('That media folder is no longer available. Choose it again.')
  }
  const previous = existingId ? await readWorkflow(root, workflowIdSchema.parse(existingId)) : null
  const now = new Date().toISOString()
  const workflow = savedWorkflowSchema.parse({
    ...input,
    version: 1,
    id: previous?.id ?? randomUUID(),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now
  })

  const directory = workflowDirectory(root, workflow.id)
  await mkdir(join(directory, 'plans'), { recursive: true })
  await mkdir(join(directory, 'runs'), { recursive: true })
  await writeJson(join(directory, 'workflow.json'), workflow)
  return workflow
}

function classify(extension: string): 'video' | 'image' | 'unmatched' {
  if (VIDEO_EXTENSIONS.has(extension)) return 'video'
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  return 'unmatched'
}

export async function createWorkflowPlan(root: string, workflowId: string): Promise<WorkflowPlan> {
  const id = workflowIdSchema.parse(workflowId)
  const workflow = await readWorkflow(root, id)
  const sourceInfo = await stat(workflow.sourceDirectory)
  if (!sourceInfo.isDirectory()) throw new Error('The workflow source is not a folder.')

  const entries = await readdir(workflow.sourceDirectory, { withFileTypes: true })
  const actions: WorkflowPlan['actions'] = []
  const skipped: WorkflowPlan['skipped'] = []

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isFile()) continue
    const sourcePath = join(workflow.sourceDirectory, entry.name)
    const category = classify(extname(entry.name).toLowerCase())
    if (category === 'unmatched' && workflow.unmatchedPolicy === 'leave') {
      skipped.push({ path: sourcePath, reason: 'No matching media category.' })
      continue
    }

    const folder =
      category === 'video'
        ? workflow.videoFolder
        : category === 'image'
          ? workflow.imageFolder
          : workflow.unmatchedFolder
    const destinationPath = join(workflow.sourceDirectory, folder, basename(entry.name))
    try {
      await stat(destinationPath)
      skipped.push({ path: sourcePath, reason: 'A file with this name already exists.' })
      continue
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }

    const sourceStat = await stat(sourcePath)
    actions.push({
      id: randomUUID(),
      category,
      operation: workflow.operation,
      sourcePath,
      destinationPath,
      size: sourceStat.size,
      modifiedAtMs: sourceStat.mtimeMs
    })
  }

  const plan = workflowPlanSchema.parse({
    version: 1,
    id: randomUUID(),
    workflowId: id,
    createdAt: new Date().toISOString(),
    actions,
    skipped
  })
  await writeJson(join(workflowDirectory(root, id), 'plans', `${plan.id}.json`), plan)
  return plan
}

async function moveWithoutOverwrite(sourcePath: string, destinationPath: string): Promise<void> {
  await copyFile(sourcePath, destinationPath, constants.COPYFILE_EXCL)
  await unlink(sourcePath)
}

export async function executeWorkflowPlan(
  root: string,
  rawInput: { workflowId: string; planId: string },
  trigger: 'manual' | 'schedule' = 'manual'
): Promise<WorkflowRun> {
  const input = executeWorkflowInputSchema.parse(rawInput)
  const planContent = await readFile(
    join(workflowDirectory(root, input.workflowId), 'plans', `${input.planId}.json`),
    'utf8'
  )
  const plan = workflowPlanSchema.parse(JSON.parse(planContent))
  if (plan.workflowId !== input.workflowId) throw new Error('The approved plan is invalid.')

  const startedAt = new Date().toISOString()
  const results: WorkflowRun['results'] = []
  for (const action of plan.actions) {
    try {
      const current = await stat(action.sourcePath)
      if (current.size !== action.size || current.mtimeMs !== action.modifiedAtMs) {
        throw new Error('The source file changed after review.')
      }
      await mkdir(dirname(action.destinationPath), { recursive: true })
      if (action.operation === 'copy') {
        await copyFile(action.sourcePath, action.destinationPath, constants.COPYFILE_EXCL)
      } else {
        await moveWithoutOverwrite(action.sourcePath, action.destinationPath)
      }
      results.push({
        actionId: action.id,
        sourcePath: action.sourcePath,
        destinationPath: action.destinationPath,
        status: 'completed',
        message: action.operation === 'copy' ? 'Copied successfully.' : 'Moved successfully.'
      })
    } catch (error) {
      results.push({
        actionId: action.id,
        sourcePath: action.sourcePath,
        destinationPath: action.destinationPath,
        status: 'failed',
        message: error instanceof Error ? error.message : 'The file operation failed.'
      })
    }
  }

  const completed = results.filter((result) => result.status === 'completed').length
  const status = completed === results.length ? 'completed' : completed > 0 ? 'partial' : 'failed'
  const run = workflowRunSchema.parse({
    version: 1,
    id: randomUUID(),
    workflowId: input.workflowId,
    planId: input.planId,
    startedAt,
    completedAt: new Date().toISOString(),
    status,
    trigger,
    results
  })
  await writeJson(join(workflowDirectory(root, input.workflowId), 'runs', `${run.id}.json`), run)
  return run
}

export function nextScheduleTime(input: SaveScheduleInput, after = new Date()): Date {
  const [hours, minutes] = input.time.split(':').map(Number)
  const next = new Date(after)
  next.setSeconds(0, 0)
  next.setHours(hours, minutes, 0, 0)
  if (input.frequency === 'daily') {
    if (next <= after) next.setDate(next.getDate() + 1)
    return next
  }
  const weekday = input.weekday ?? 1
  let days = (weekday - next.getDay() + 7) % 7
  if (days === 0 && next <= after) days = 7
  next.setDate(next.getDate() + days)
  return next
}

export async function saveWorkflowSchedule(
  root: string,
  rawInput: SaveScheduleInput,
  now = new Date()
): Promise<WorkflowSchedule> {
  const input = saveScheduleInputSchema.parse(rawInput)
  await readWorkflow(root, input.workflowId)
  const path = join(workflowDirectory(root, input.workflowId), 'schedule.json')
  let createdAt = now.toISOString()
  try {
    const existing = workflowScheduleSchema.parse(JSON.parse(await readFile(path, 'utf8')))
    createdAt = existing.createdAt
  } catch {
    // A missing schedule starts a new recurring configuration.
  }
  const schedule = workflowScheduleSchema.parse({
    ...input,
    version: 1,
    enabled: true,
    nextRunAt: nextScheduleTime(input, now).toISOString(),
    createdAt,
    updatedAt: now.toISOString()
  })
  await writeJson(path, schedule)
  return schedule
}

export async function listWorkflowHistory(root: string): Promise<WorkflowHistoryEntry[]> {
  let workflowIds: string[] = []
  try {
    workflowIds = await readdir(root)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const entries: WorkflowHistoryEntry[] = []
  for (const workflowId of workflowIds) {
    let workflow: SavedWorkflow
    try {
      workflow = await readWorkflow(root, workflowId)
    } catch {
      continue
    }
    let files: string[] = []
    try {
      files = await readdir(join(workflowDirectory(root, workflowId), 'runs'))
    } catch {
      continue
    }
    for (const file of files.filter((name) => name.endsWith('.json'))) {
      const run = workflowRunSchema.parse(
        JSON.parse(await readFile(join(workflowDirectory(root, workflowId), 'runs', file), 'utf8'))
      )
      entries.push(
        workflowHistoryEntrySchema.parse({
          workflowName: workflow.name,
          workflowGoal: workflow.goal,
          run
        })
      )
    }
  }
  return entries.sort((left, right) => right.run.completedAt.localeCompare(left.run.completedAt))
}

export async function runDueSchedules(root: string, now = new Date()): Promise<WorkflowRun[]> {
  let workflowIds: string[] = []
  try {
    workflowIds = await readdir(root)
  } catch {
    return []
  }
  const runs: WorkflowRun[] = []
  for (const workflowId of workflowIds) {
    const path = join(workflowDirectory(root, workflowId), 'schedule.json')
    let schedule: WorkflowSchedule
    try {
      schedule = workflowScheduleSchema.parse(JSON.parse(await readFile(path, 'utf8')))
    } catch {
      continue
    }
    if (!schedule.enabled || new Date(schedule.nextRunAt) > now) continue
    const plan = await createWorkflowPlan(root, workflowId)
    runs.push(await executeWorkflowPlan(root, { workflowId, planId: plan.id }, 'schedule'))
    const next = workflowScheduleSchema.parse({
      ...schedule,
      nextRunAt: nextScheduleTime(schedule, now).toISOString(),
      updatedAt: now.toISOString()
    })
    await writeJson(path, next)
  }
  return runs
}
