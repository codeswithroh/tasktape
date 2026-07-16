import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { config } from 'dotenv'
import { describe, expect, it } from 'vitest'

import { requestOpenAITranscription } from './analysis.js'

config({ path: [resolve('.env.local'), resolve('.env')], quiet: true })

describe('live OpenAI intent transcription', () => {
  it('transcribes a bounded voice note through the production provider', async () => {
    const audio = await readFile(resolve('output/live/tasktape-intent.wav'))
    const data = audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength)
    const transcript = await requestOpenAITranscription({ data, mimeType: 'audio/wav' })

    expect(transcript.toLowerCase()).toContain('organize')
    expect(transcript.toLowerCase()).toContain('monday')
  })
})
