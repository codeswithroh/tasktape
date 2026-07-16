import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MAX_TRANSCRIPTION_AUDIO_BYTES } from '../shared/analysis-contracts.js'

const openAIMocks = vi.hoisted(() => ({
  create: vi.fn(),
  toFile: vi.fn()
}))

vi.mock('openai', () => ({
  default: class OpenAI {
    audio = { transcriptions: { create: openAIMocks.create } }
  },
  toFile: openAIMocks.toFile
}))

import { requestOpenAITranscription, TRANSCRIPTION_MODEL, transcribeIntent } from './analysis.js'

const validInput = {
  data: new Uint8Array([1, 2, 3]).buffer,
  mimeType: 'audio/webm' as const
}

describe('intent transcription boundary', () => {
  beforeEach(() => {
    openAIMocks.create.mockReset()
    openAIMocks.toFile.mockReset()
  })

  it('validates input and trims a deterministic provider transcript', async () => {
    const provider = vi.fn().mockResolvedValue('  Move invoices into client folders.  ')

    await expect(transcribeIntent(validInput, provider)).resolves.toEqual({
      text: 'Move invoices into client folders.'
    })
    expect(provider).toHaveBeenCalledWith(validInput)
  })

  it.each([
    [{ ...validInput, data: new ArrayBuffer(0) }, 'Audio cannot be empty.'],
    [
      { ...validInput, data: new ArrayBuffer(MAX_TRANSCRIPTION_AUDIO_BYTES + 1) },
      'Audio must be 25 MB or smaller.'
    ],
    [{ ...validInput, mimeType: 'text/plain' }, 'Invalid option']
  ])('rejects invalid audio before calling the provider', async (input, message) => {
    const provider = vi.fn()

    await expect(transcribeIntent(input as typeof validInput, provider)).rejects.toThrow(message)
    expect(provider).not.toHaveBeenCalled()
  })

  it('uploads a server-named file with the production transcription model', async () => {
    const upload = { name: 'tasktape-intent.webm' }
    openAIMocks.toFile.mockResolvedValue(upload)
    openAIMocks.create.mockResolvedValue({ text: 'Describe the demonstrated workflow.' })

    await expect(requestOpenAITranscription(validInput, 'sk-test-key')).resolves.toBe(
      'Describe the demonstrated workflow.'
    )
    expect(openAIMocks.toFile).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      'tasktape-intent.webm',
      { type: 'audio/webm' }
    )
    expect(openAIMocks.create).toHaveBeenCalledWith({
      file: upload,
      model: TRANSCRIPTION_MODEL,
      response_format: 'json'
    })
    expect(TRANSCRIPTION_MODEL).toBe('gpt-4o-mini-transcribe')
  })
})
