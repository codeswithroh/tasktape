import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { CredentialCipher } from './api-credentials.js'
import { clearApiKey, getApiKeyStatus, resolveApiKey, saveApiKey } from './api-credentials.js'

const roots: string[] = []
const appKey = `sk-proj-${'a'.repeat(80)}`
const environmentKey = `sk-proj-${'b'.repeat(80)}`
const cipher: CredentialCipher = {
  isAvailable: () => true,
  encrypt: (value) => Buffer.from(value.split('').reverse().join('')),
  decrypt: (value) => value.toString().split('').reverse().join('')
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function createRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'tasktape-credentials-'))
  roots.push(root)
  return root
}

describe('API credential storage', () => {
  it('stores an encrypted app key with restrictive permissions and prefers it', async () => {
    const root = await createRoot()
    await saveApiKey(root, appKey, cipher)

    const path = join(root, 'settings', 'credentials.json')
    const stored = await readFile(path, 'utf8')
    expect(stored).not.toContain(appKey)
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    await expect(resolveApiKey(root, environmentKey, cipher)).resolves.toEqual({
      apiKey: appKey,
      source: 'app'
    })
  })

  it('falls back to an environment key after the app key is cleared', async () => {
    const root = await createRoot()
    await saveApiKey(root, appKey, cipher)
    await expect(clearApiKey(root, environmentKey, cipher)).resolves.toEqual({
      configured: true,
      source: 'environment'
    })
  })

  it('reports no key without exposing a value', async () => {
    const root = await createRoot()
    await expect(getApiKeyStatus(root, undefined, cipher)).resolves.toEqual({
      configured: false,
      source: 'none'
    })
  })
})
