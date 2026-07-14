import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { removeRecording, saveRecording } from './recordings.js'

const temporaryDirectories: string[] = []

async function createRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'tasktape-recordings-'))
  temporaryDirectories.push(root)
  return root
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })))
})

describe('recording persistence', () => {
  it('writes media and metadata, then removes both', async () => {
    const root = await createRoot()
    const data = new Uint8Array([26, 45, 223, 163]).buffer
    const metadata = await saveRecording(root, {
      data,
      durationMs: 1_250,
      mimeType: 'video/webm;codecs=vp9'
    })

    await expect(stat(join(root, `${metadata.id}.webm`))).resolves.toMatchObject({ size: 4 })
    await expect(readFile(join(root, `${metadata.id}.json`), 'utf8')).resolves.toContain(
      metadata.id
    )

    await removeRecording(root, metadata.id)
    await expect(stat(join(root, `${metadata.id}.webm`))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(stat(join(root, `${metadata.id}.json`))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects empty and unsupported recordings', async () => {
    const root = await createRoot()

    await expect(
      saveRecording(root, {
        data: new ArrayBuffer(0),
        durationMs: 1_000,
        mimeType: 'video/webm'
      })
    ).rejects.toThrow(/Recording size/)

    await expect(
      saveRecording(root, {
        data: new Uint8Array([1]).buffer,
        durationMs: 1_000,
        mimeType: 'video/mp4'
      })
    ).rejects.toThrow()
  })

  it('rejects path-like recording identifiers', async () => {
    const root = await createRoot()
    await expect(removeRecording(root, '../outside')).rejects.toThrow()
  })
})
