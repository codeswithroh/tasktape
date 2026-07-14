import { z } from 'zod'

const absoluteDirectorySchema = z
  .string()
  .trim()
  .min(1)
  .max(1_024)
  .refine((value) => value.startsWith('/'), 'Choose an absolute folder path.')

const folderNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine(
    (value) => value !== '.' && value !== '..' && !value.includes('/') && !value.includes('\\'),
    'Use a single folder name without slashes.'
  )

export const workflowIdSchema = z.string().uuid()

export const saveWorkflowInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  goal: z.string().trim().min(1).max(240),
  sourceDirectory: absoluteDirectorySchema,
  videoFolder: folderNameSchema,
  imageFolder: folderNameSchema,
  operation: z.enum(['move', 'copy']),
  unmatchedPolicy: z.enum(['leave', 'move']),
  unmatchedFolder: folderNameSchema
})

export const savedWorkflowSchema = saveWorkflowInputSchema.extend({
  version: z.literal(1),
  id: workflowIdSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export const workflowPlanActionSchema = z.object({
  id: z.string().uuid(),
  category: z.enum(['video', 'image', 'unmatched']),
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

export type SaveWorkflowInput = z.infer<typeof saveWorkflowInputSchema>
export type SavedWorkflow = z.infer<typeof savedWorkflowSchema>
export type WorkflowPlan = z.infer<typeof workflowPlanSchema>
export type WorkflowRun = z.infer<typeof workflowRunSchema>
