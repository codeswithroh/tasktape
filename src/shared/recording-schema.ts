import { z } from 'zod'

export const recordingDetailsSchema = z.object({
  durationMs: z.number().int().min(100).max(3_600_000),
  mimeType: z.string().regex(/^video\/webm(?:;codecs=(?:vp8|vp9)(?:,opus)?)?$/)
})

export const recordingIdSchema = z.string().uuid()

export const MAX_RECORDING_BYTES = 500 * 1024 * 1024
