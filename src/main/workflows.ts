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
  legacySavedWorkflowSchema,
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
  workflowHistoryEntrySchema,
  versionTwoSavedWorkflowSchema,
  type ScheduledTask,
  scheduledTaskSchema,
  type SetScheduleEnabledInput,
  setScheduleEnabledInputSchema
} from '../shared/workflow-schema.js'

const LEGACY_VIDEO_EXTENSIONS = ['.avi', '.m4v', '.mkv', '.mov', '.mp4', '.webm']
const LEGACY_IMAGE_EXTENSIONS = ['.gif', '.heic', '.jpeg', '.jpg', '.png', '.raw', '.webp']

async function writeJson(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.${randomUUID()}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  await rename(temporaryPath, path)
}

function workflowDirectory(root: string, workflowId: string): string {
  return join(root, workflowId)
}

export async function readWorkflow(root: string, workflowId: string): Promise<SavedWorkflow> {
  const id = workflowIdSchema.parse(workflowId)
  const path = join(workflowDirectory(root, id), 'workflow.json')
  const content = JSON.parse(await readFile(path, 'utf8'))
  const current = savedWorkflowSchema.safeParse(content)
  if (current.success) return current.data

  const versionTwo = versionTwoSavedWorkflowSchema.safeParse(content)
  if (versionTwo.success) {
    const migrated = savedWorkflowSchema.parse({
      ...versionTwo.data,
      version: 3,
      instructions: versionTwo.data.goal,
      approvalMode: 'allow_unattended'
    })
    await writeJson(path, migrated)
    return migrated
  }

  const legacy = legacySavedWorkflowSchema.parse(content)
  const migrated = savedWorkflowSchema.parse({
    version: 3,
    id: legacy.id,
    name: legacy.name,
    goal: legacy.goal,
    instructions: legacy.goal,
    approvalMode: 'allow_unattended',
    capability: 'organize_files',
    sourceDirectory: legacy.sourceDirectory,
    operation: legacy.operation,
    rules: [
      {
        id: 'video_files',
        label: 'Video files',
        extensions: LEGACY_VIDEO_EXTENSIONS,
        destinationFolder: legacy.videoFolder
      },
      {
        id: 'image_files',
        label: 'Image files',
        extensions: LEGACY_IMAGE_EXTENSIONS,
        destinationFolder: legacy.imageFolder
      }
    ],
    unmatchedPolicy: legacy.unmatchedPolicy,
    unmatchedFolder: legacy.unmatchedPolicy === 'move' ? legacy.unmatchedFolder : null,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt
  })
  await writeJson(path, migrated)
  return migrated
}

export async function saveWorkflow(
  root: string,
  rawInput: SaveWorkflowInput,
  existingId?: string
): Promise<SavedWorkflow> {
  const input = saveWorkflowInputSchema.parse(rawInput)
  if (input.capability === 'organize_files') {
    const sourceInfo = await stat(input.sourceDirectory).catch(() => null)
    if (!sourceInfo?.isDirectory()) {
      throw new Error('That source folder is no longer available. Choose it again.')
    }
  }
  const previous = existingId ? await readWorkflow(root, workflowIdSchema.parse(existingId)) : null
  const now = new Date().toISOString()
  const workflow = savedWorkflowSchema.parse({
    ...input,
    version: 3,
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

type SavedFileWorkflow = Extract<SavedWorkflow, { capability: 'organize_files' }>

function findRule(
  workflow: SavedFileWorkflow,
  extension: string
): SavedFileWorkflow['rules'][number] | null {
  return workflow.rules.find((rule) => rule.extensions.includes(extension)) ?? null
}

export async function createWorkflowPlan(root: string, workflowId: string): Promise<WorkflowPlan> {
  const id = workflowIdSchema.parse(workflowId)
  const workflow = await readWorkflow(root, id)
  if (workflow.capability !== 'organize_files') {
    throw new Error('Computer tasks run directly and do not create a file plan.')
  }
  const sourceInfo = await stat(workflow.sourceDirectory)
  if (!sourceInfo.isDirectory()) throw new Error('The workflow source is not a folder.')

  const entries = await readdir(workflow.sourceDirectory, { withFileTypes: true })
  const actions: WorkflowPlan['actions'] = []
  const skipped: WorkflowPlan['skipped'] = []

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isFile()) continue
    const sourcePath = join(workflow.sourceDirectory, entry.name)
    const rule = findRule(workflow, extname(entry.name).toLowerCase())
    if (!rule && workflow.unmatchedPolicy === 'leave') {
      skipped.push({ path: sourcePath, reason: 'No learned rule matches this file type.' })
      continue
    }

    const folder = rule?.destinationFolder ?? workflow.unmatchedFolder
    if (!folder) {
      skipped.push({ path: sourcePath, reason: 'No destination is configured for this file type.' })
      continue
    }
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
      category: rule?.label ?? 'Unmatched files',
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

function fileOperationError(error: unknown): string {
  if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
    return 'A file with this name already exists.'
  }
  const message = error instanceof Error ? error.message : 'The file operation failed.'
  return message.slice(0, 240)
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
        message: fileOperationError(error)
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

export interface ComputerTaskResult {
  output: string
  actionLog: string[]
  verification?: {
    status: 'passed' | 'failed' | 'inconclusive'
    expectedOutcome: string
    summary: string
    evidence: string[]
    screenshotDataUrl: string
  } | null
}

export type ComputerTaskRunner = (
  workflow: Extract<SavedWorkflow, { capability: 'computer' }>
) => Promise<ComputerTaskResult>

export async function executeComputerTask(
  root: string,
  workflowId: string,
  runner: ComputerTaskRunner,
  trigger: 'manual' | 'schedule' = 'manual'
): Promise<WorkflowRun> {
  const workflow = await readWorkflow(root, workflowId)
  if (workflow.capability !== 'computer')
    throw new Error('This task does not use computer control.')

  const startedAt = new Date().toISOString()
  let status: WorkflowRun['status'] = 'completed'
  let messages: string[]
  let verification: WorkflowRun['verification'] = null
  try {
    const result = await runner(workflow)
    verification = result.verification ?? null
    if (verification?.status === 'failed') status = 'failed'
    messages = result.actionLog.length > 0 ? result.actionLog : [result.output || 'Task completed.']
  } catch (error) {
    status = 'failed'
    const actionLog =
      typeof error === 'object' &&
      error !== null &&
      'actionLog' in error &&
      Array.isArray(error.actionLog)
        ? error.actionLog.filter((entry): entry is string => typeof entry === 'string')
        : []
    const message = error instanceof Error ? error.message : 'The computer task failed.'
    messages = [...actionLog, message]
  }

  const results = messages.slice(0, 1_000).map((message) => ({
    actionId: randomUUID(),
    sourcePath: 'computer://desktop',
    destinationPath: 'computer://desktop',
    status: status === 'completed' ? ('completed' as const) : ('failed' as const),
    message: message.slice(0, 240)
  }))
  const run = workflowRunSchema.parse({
    version: 1,
    id: randomUUID(),
    workflowId: workflow.id,
    planId: randomUUID(),
    startedAt,
    completedAt: new Date().toISOString(),
    status,
    trigger,
    verification,
    results
  })
  await writeJson(join(workflowDirectory(root, workflow.id), 'runs', `${run.id}.json`), run)
  return run
}

export function nextScheduleTime(input: SaveScheduleInput, after = new Date()): Date {
  if (input.frequency === 'hourly') {
    const next = new Date(after)
    next.setMinutes(0, 0, 0)
    next.setHours(next.getHours() + 1)
    return next
  }
  if (!input.time) throw new Error('Choose a time for this schedule.')
  const [hours, minutes] = input.time.split(':').map(Number)
  const next = new Date(after)
  next.setSeconds(0, 0)
  next.setHours(hours, minutes, 0, 0)
  if (input.frequency === 'daily') {
    if (next <= after) next.setDate(next.getDate() + 1)
    return next
  }
  if (input.frequency === 'weekdays') {
    do {
      if (next <= after) next.setDate(next.getDate() + 1)
      if (next.getDay() === 6) next.setDate(next.getDate() + 2)
      if (next.getDay() === 0) next.setDate(next.getDate() + 1)
    } while (next <= after)
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

async function latestWorkflowRun(root: string, workflowId: string): Promise<WorkflowRun | null> {
  let files: string[]
  try {
    files = await readdir(join(workflowDirectory(root, workflowId), 'runs'))
  } catch {
    return null
  }
  const runs = await Promise.all(
    files
      .filter((name) => name.endsWith('.json'))
      .map(async (file) =>
        workflowRunSchema.parse(
          JSON.parse(
            await readFile(join(workflowDirectory(root, workflowId), 'runs', file), 'utf8')
          )
        )
      )
  )
  return runs.sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0] ?? null
}

export async function listScheduledTasks(root: string): Promise<ScheduledTask[]> {
  let workflowIds: string[]
  try {
    workflowIds = await readdir(root)
  } catch {
    return []
  }
  const tasks: ScheduledTask[] = []
  for (const workflowId of workflowIds) {
    try {
      const workflow = await readWorkflow(root, workflowId)
      const schedule = workflowScheduleSchema.parse(
        JSON.parse(
          await readFile(join(workflowDirectory(root, workflowId), 'schedule.json'), 'utf8')
        )
      )
      tasks.push(
        scheduledTaskSchema.parse({
          workflow,
          schedule,
          lastRun: await latestWorkflowRun(root, workflowId)
        })
      )
    } catch {
      continue
    }
  }
  return tasks.sort((left, right) =>
    left.schedule.nextRunAt.localeCompare(right.schedule.nextRunAt)
  )
}

export async function setWorkflowScheduleEnabled(
  root: string,
  rawInput: SetScheduleEnabledInput,
  now = new Date()
): Promise<WorkflowSchedule> {
  const input = setScheduleEnabledInputSchema.parse(rawInput)
  const path = join(workflowDirectory(root, input.workflowId), 'schedule.json')
  const current = workflowScheduleSchema.parse(JSON.parse(await readFile(path, 'utf8')))
  const schedule = workflowScheduleSchema.parse({
    ...current,
    enabled: input.enabled,
    nextRunAt: input.enabled ? nextScheduleTime(current, now).toISOString() : current.nextRunAt,
    updatedAt: now.toISOString()
  })
  await writeJson(path, schedule)
  return schedule
}

export async function runDueSchedules(
  root: string,
  now = new Date(),
  computerRunner?: ComputerTaskRunner
): Promise<WorkflowRun[]> {
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
    const workflow = await readWorkflow(root, workflowId)
    if (workflow.capability === 'computer') {
      if (!computerRunner) throw new Error('The computer task runner is unavailable.')
      if (workflow.approvalMode !== 'allow_unattended') {
        throw new Error('This computer task is not approved for unattended runs.')
      }
      runs.push(await executeComputerTask(root, workflowId, computerRunner, 'schedule'))
    } else {
      const plan = await createWorkflowPlan(root, workflowId)
      runs.push(await executeWorkflowPlan(root, { workflowId, planId: plan.id }, 'schedule'))
    }
    const next = workflowScheduleSchema.parse({
      ...schedule,
      nextRunAt: nextScheduleTime(schedule, now).toISOString(),
      updatedAt: now.toISOString()
    })
    await writeJson(path, next)
  }
  return runs
}
