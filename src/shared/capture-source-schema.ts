import { z } from 'zod'

export const captureSourceIdSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^(?:screen|window):/)
