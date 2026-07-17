import { z } from 'zod'

const absoluteDirectorySchema = z
  .string()
  .trim()
  .min(1)
  .max(1_024)
  .refine((value) => value.startsWith('/'), 'Choose an absolute folder path.')

export const childDirectoryNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine(
    (value) => value !== '.' && value !== '..' && !value.includes('/') && !value.includes('\\'),
    'Use a single folder name without slashes.'
  )

export const workflowIdSchema = z.string().uuid()

export const learnedFileRuleSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
  label: z.string().trim().min(1).max(80),
  extensions: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^\.[a-z0-9]{1,10}$/)
    )
    .min(1)
    .max(24),
  destinationFolder: childDirectoryNameSchema
})

const commonTaskFieldsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  goal: z.string().trim().min(1).max(240),
  instructions: z.string().trim().min(1).max(2_000),
  approvalMode: z.enum(['review_each_run', 'allow_unattended'])
})

const organizeFilesTaskFieldsSchema = commonTaskFieldsSchema.extend({
  capability: z.literal('organize_files'),
  sourceDirectory: absoluteDirectorySchema,
  operation: z.enum(['move', 'copy']),
  rules: z.array(learnedFileRuleSchema).min(1).max(20),
  unmatchedPolicy: z.enum(['leave', 'move']),
  unmatchedFolder: childDirectoryNameSchema.nullable()
})

const computerTaskFieldsSchema = commonTaskFieldsSchema.extend({
  capability: z.literal('computer'),
  targetApp: z.string().trim().min(1).max(120).nullable()
})

const saveWorkflowFieldsSchema = z.discriminatedUnion('capability', [
  organizeFilesTaskFieldsSchema,
  computerTaskFieldsSchema
])

function validateLearnedRules(
  workflow: z.infer<typeof saveWorkflowFieldsSchema>,
  context: z.RefinementCtx
): void {
  if (workflow.capability !== 'organize_files') return
  const extensions = new Set<string>()
  workflow.rules.forEach((rule, ruleIndex) => {
    rule.extensions.forEach((extension, extensionIndex) => {
      if (extensions.has(extension)) {
        context.addIssue({
          code: 'custom',
          path: ['rules', ruleIndex, 'extensions', extensionIndex],
          message: `Only one learned rule can handle ${extension}.`
        })
      }
      extensions.add(extension)
    })
  })
  if (workflow.unmatchedPolicy === 'move' && !workflow.unmatchedFolder) {
    context.addIssue({
      code: 'custom',
      path: ['unmatchedFolder'],
      message: 'A destination is required for unmatched files.'
    })
  }
}

export const saveWorkflowInputSchema = saveWorkflowFieldsSchema.superRefine(validateLearnedRules)

const persistedTaskFields = {
  version: z.literal(3),
  id: workflowIdSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}

export const savedWorkflowSchema = z
  .discriminatedUnion('capability', [
    organizeFilesTaskFieldsSchema.extend(persistedTaskFields),
    computerTaskFieldsSchema.extend(persistedTaskFields)
  ])
  .superRefine(validateLearnedRules)

export const versionTwoSavedWorkflowSchema = z.object({
  version: z.literal(2),
  id: workflowIdSchema,
  name: z.string().trim().min(1).max(80),
  goal: z.string().trim().min(1).max(240),
  capability: z.literal('organize_files'),
  sourceDirectory: absoluteDirectorySchema,
  operation: z.enum(['move', 'copy']),
  rules: z.array(learnedFileRuleSchema).min(1).max(20),
  unmatchedPolicy: z.enum(['leave', 'move']),
  unmatchedFolder: childDirectoryNameSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export const legacySavedWorkflowSchema = z.object({
  version: z.literal(1),
  id: workflowIdSchema,
  name: z.string().trim().min(1).max(80),
  goal: z.string().trim().min(1).max(240),
  sourceDirectory: absoluteDirectorySchema,
  videoFolder: childDirectoryNameSchema,
  imageFolder: childDirectoryNameSchema,
  operation: z.enum(['move', 'copy']),
  unmatchedPolicy: z.enum(['leave', 'move']),
  unmatchedFolder: childDirectoryNameSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export const workflowPlanActionSchema = z.object({
  id: z.string().uuid(),
  category: z.string().trim().min(1).max(80),
  operation: z.enum(['move', 'copy']),
  sourcePath: z.string().min(1).max(2_048),
  destinationPath: z.string().min(1).max(2_048),
  size: z.number().int().nonnegative(),
  modifiedAtMs: z.number().nonnegative()
})

export const workflowPlanSchema = z.object({
  version: z.literal(1),
  id: z.string().uuid(),
  workflowId: workflowIdSchema,
  createdAt: z.string().datetime(),
  actions: z.array(workflowPlanActionSchema).max(1_000),
  skipped: z
    .array(
      z.object({
        path: z.string().min(1).max(2_048),
        reason: z.string().min(1).max(180)
      })
    )
    .max(1_000)
})

export const executeWorkflowInputSchema = z.object({
  workflowId: workflowIdSchema,
  planId: z.string().uuid()
})

export const runTaskInputSchema = z.object({
  workflowId: workflowIdSchema
})

export const workflowRunSchema = z.object({
  version: z.literal(1),
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  planId: z.string().uuid(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  status: z.enum(['completed', 'partial', 'failed']),
  trigger: z.enum(['manual', 'schedule']).default('manual'),
  results: z.array(
    z.object({
      actionId: z.string().uuid(),
      sourcePath: z.string().min(1).max(2_048),
      destinationPath: z.string().min(1).max(2_048),
      status: z.enum(['completed', 'failed']),
      message: z.string().min(1).max(240)
    })
  )
})

const scheduleFieldsSchema = z.object({
  workflowId: workflowIdSchema,
  frequency: z.enum(['hourly', 'daily', 'weekdays', 'weekly']),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  weekday: z.number().int().min(0).max(6).nullable()
})

function validateSchedule(
  schedule: z.infer<typeof scheduleFieldsSchema>,
  context: z.RefinementCtx
): void {
  if (schedule.frequency !== 'hourly' && !schedule.time) {
    context.addIssue({
      code: 'custom',
      path: ['time'],
      message: 'Choose a time for this schedule.'
    })
  }
  if (schedule.frequency === 'weekly' && schedule.weekday === null) {
    context.addIssue({
      code: 'custom',
      path: ['weekday'],
      message: 'Choose a day for this weekly schedule.'
    })
  }
}

export const saveScheduleInputSchema = scheduleFieldsSchema.superRefine(validateSchedule)

export const workflowScheduleSchema = scheduleFieldsSchema
  .extend({
    version: z.literal(1),
    enabled: z.boolean(),
    nextRunAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
  .superRefine(validateSchedule)

export const workflowHistoryEntrySchema = z.object({
  workflowName: z.string().min(1).max(80),
  workflowGoal: z.string().min(1).max(240),
  run: workflowRunSchema
})

export const scheduledTaskSchema = z.object({
  workflow: savedWorkflowSchema,
  schedule: workflowScheduleSchema,
  lastRun: workflowRunSchema.nullable()
})

export const setScheduleEnabledInputSchema = z.object({
  workflowId: workflowIdSchema,
  enabled: z.boolean()
})

export type SaveWorkflowInput = z.infer<typeof saveWorkflowInputSchema>
export type SavedWorkflow = z.infer<typeof savedWorkflowSchema>
export type WorkflowPlan = z.infer<typeof workflowPlanSchema>
export type WorkflowRun = z.infer<typeof workflowRunSchema>
export type SaveScheduleInput = z.infer<typeof saveScheduleInputSchema>
export type WorkflowSchedule = z.infer<typeof workflowScheduleSchema>
export type WorkflowHistoryEntry = z.infer<typeof workflowHistoryEntrySchema>
export type ScheduledTask = z.infer<typeof scheduledTaskSchema>
export type SetScheduleEnabledInput = z.infer<typeof setScheduleEnabledInputSchema>
