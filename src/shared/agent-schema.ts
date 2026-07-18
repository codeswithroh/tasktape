import { z } from 'zod'

export const bugSessionIdSchema = z.string().uuid()

export const browserUrlSchema = z
  .string()
  .trim()
  .max(2_048)
  .url()
  .refine((value) => {
    const url = new URL(value)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
  }, 'Use a local HTTP or HTTPS URL without embedded credentials.')

export const startBugSessionInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  url: browserUrlSchema,
  expectedOutcome: z.string().trim().min(1).max(500),
  issueContext: z.string().trim().max(2_000).default('')
})

export const browserRoleSchema = z.enum([
  'button',
  'checkbox',
  'combobox',
  'dialog',
  'heading',
  'link',
  'listbox',
  'menuitem',
  'option',
  'radio',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'textbox'
])

export const browserSelectorSchema = z
  .object({
    role: browserRoleSchema.optional(),
    name: z.string().trim().min(1).max(240).optional(),
    label: z.string().trim().min(1).max(240).optional(),
    text: z.string().trim().min(1).max(240).optional(),
    css: z.string().trim().min(1).max(500).optional()
  })
  .superRefine((selector, context) => {
    const strategies = [selector.role, selector.label, selector.text, selector.css].filter(Boolean)
    if (strategies.length !== 1) {
      context.addIssue({
        code: 'custom',
        message: 'Choose exactly one selector strategy: role, label, text, or css.'
      })
    }
    if (selector.name && !selector.role) {
      context.addIssue({
        code: 'custom',
        path: ['name'],
        message: 'A name can only be used with a role.'
      })
    }
  })

export const clickInputSchema = z.object({
  selector: browserSelectorSchema
})

export const fillInputSchema = z.object({
  selector: browserSelectorSchema,
  value: z.string().max(4_000)
})

export const selectOptionInputSchema = z.object({
  selector: browserSelectorSchema,
  value: z.string().trim().min(1).max(240)
})

export const pressKeyInputSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z0-9+]+$/, 'Use a Playwright key or key chord such as Enter or Control+K.')
})

export const waitForInputSchema = z
  .object({
    text: z.string().trim().min(1).max(240).optional(),
    milliseconds: z.number().int().min(100).max(5_000).optional()
  })
  .refine((input) => Boolean(input.text) !== Boolean(input.milliseconds), {
    message: 'Wait for either visible text or a duration.'
  })

export const addSessionNoteInputSchema = z.object({
  note: z.string().trim().min(1).max(1_000)
})

export const finishBugSessionInputSchema = z.object({
  replayInstructions: z.string().trim().max(2_000).optional()
})

export const agentActionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['click', 'fill', 'select_option', 'press_key', 'wait_for', 'note']),
  summary: z.string().min(1).max(1_000),
  createdAt: z.string().datetime(),
  screenshotFile: z.string().min(1).max(160).nullable()
})

const browserLogSchema = z.object({
  type: z.string().min(1).max(40),
  summary: z.string().min(1).max(1_000),
  createdAt: z.string().datetime()
})

export const bugSessionSchema = z.object({
  version: z.literal(1),
  id: bugSessionIdSchema,
  name: z.string().min(1).max(80),
  url: browserUrlSchema,
  expectedOutcome: z.string().min(1).max(500),
  issueContext: z.string().max(2_000),
  status: z.enum(['active', 'completed', 'abandoned']),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  actions: z.array(agentActionSchema).max(100),
  console: z.array(browserLogSchema).max(500),
  network: z.array(browserLogSchema).max(500),
  initialScreenshotFile: z.string().min(1).max(160),
  finalScreenshotFile: z.string().min(1).max(160).nullable(),
  traceFile: z.string().min(1).max(160),
  replayInstructions: z.string().max(2_000).nullable(),
  workflowId: z.string().uuid().nullable()
})

export const agentServerStatusSchema = z.object({
  running: z.boolean(),
  endpoint: z.string().url(),
  activeSession: z
    .object({
      id: bugSessionIdSchema,
      name: z.string().min(1).max(80),
      url: browserUrlSchema,
      actionCount: z.number().int().nonnegative()
    })
    .nullable()
})

export type AgentServerStatus = z.infer<typeof agentServerStatusSchema>
export type BrowserSelector = z.infer<typeof browserSelectorSchema>
export type BugSession = z.infer<typeof bugSessionSchema>
export type StartBugSessionInput = z.infer<typeof startBugSessionInputSchema>
