import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { RecordingMetadata, SaveRecordingInput } from '../shared/contracts.js'
import {
  MAX_RECORDING_BYTES,
  recordingDetailsSchema,
  recordingIdSchema
} from '../shared/recording-schema.js'

function recordingPaths(root: string, id: string): { media: string; metadata: string } {
  const validId = recordingIdSchema.parse(id)
  return {
    media: join(root, `${validId}.webm`),
    metadata: join(root, `${validId}.json`)
  }
}

export async function saveRecording(
  root: string,
  input: SaveRecordingInput
): Promise<RecordingMetadata> {
  const details = recordingDetailsSchema.parse(input)
  const bytes = input.data.byteLength

  if (bytes === 0 || bytes > MAX_RECORDING_BYTES) {
    throw new Error(`Recording size must be between 1 and ${MAX_RECORDING_BYTES} bytes`)
  }

  const id = randomUUID()
  const paths = recordingPaths(root, id)
  const metadata: RecordingMetadata = {
    id,
    createdAt: new Date().toISOString(),
    durationMs: details.durationMs,
    mimeType: details.mimeType,
    bytes
  }

  await mkdir(root, { recursive: true })
  await writeFile(paths.media, new Uint8Array(input.data), { flag: 'wx' })

  try {
    await writeFile(paths.metadata, `${JSON.stringify(metadata, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx'
    })
  } catch (error) {
    await rm(paths.media, { force: true })
    throw error
  }

  return metadata
}

export async function removeRecording(root: string, id: string): Promise<void> {
  const paths = recordingPaths(root, id)
  await Promise.all([rm(paths.media, { force: true }), rm(paths.metadata, { force: true })])
}
