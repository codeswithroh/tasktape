import { z } from 'zod'

export const openAIApiKeySchema = z
  .string()
  .trim()
  .min(40)
  .max(512)
  .regex(/^sk-[A-Za-z0-9_-]+$/, 'Enter a valid OpenAI API key.')

export const encryptedCredentialsSchema = z.object({
  version: z.literal(1),
  openAIApiKey: z.string().min(1).max(2_000)
})
