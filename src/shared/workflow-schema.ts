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

const saveWorkflowFieldsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  goal: z.string().trim().min(1).max(240),
  capability: z.literal('organize_files'),
  sourceDirectory: absoluteDirectorySchema,
  operation: z.enum(['move', 'copy']),
  rules: z.array(learnedFileRuleSchema).min(1).max(20),
  unmatchedPolicy: z.enum(['leave', 'move']),
  unmatchedFolder: childDirectoryNameSchema.nullable()
})

function validateLearnedRules(
  workflow: z.infer<typeof saveWorkflowFieldsSchema>,
  context: z.RefinementCtx
): void {
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

export const savedWorkflowSchema = saveWorkflowFieldsSchema
  .extend({
    version: z.literal(2),
    id: workflowIdSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
  .superRefine(validateLearnedRules)

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

export const saveScheduleInputSchema = z.object({
  workflowId: workflowIdSchema,
  frequency: z.enum(['daily', 'weekly']),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  weekday: z.number().int().min(0).max(6).nullable()
})

export const workflowScheduleSchema = saveScheduleInputSchema.extend({
  version: z.literal(1),
  enabled: z.boolean(),
  nextRunAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export const workflowHistoryEntrySchema = z.object({
  workflowName: z.string().min(1).max(80),
  workflowGoal: z.string().min(1).max(240),
  run: workflowRunSchema
})

export type SaveWorkflowInput = z.infer<typeof saveWorkflowInputSchema>
export type SavedWorkflow = z.infer<typeof savedWorkflowSchema>
export type WorkflowPlan = z.infer<typeof workflowPlanSchema>
export type WorkflowRun = z.infer<typeof workflowRunSchema>
export type SaveScheduleInput = z.infer<typeof saveScheduleInputSchema>
export type WorkflowSchedule = z.infer<typeof workflowScheduleSchema>
export type WorkflowHistoryEntry = z.infer<typeof workflowHistoryEntrySchema>
