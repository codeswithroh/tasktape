import { randomUUID } from 'node:crypto'
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { ApiKeyStatus } from '../shared/contracts.js'
import { encryptedCredentialsSchema, openAIApiKeySchema } from '../shared/settings-schema.js'

export interface CredentialCipher {
  isAvailable: () => boolean
  encrypt: (plainText: string) => Buffer
  decrypt: (encrypted: Buffer) => string
}

function credentialsPath(root: string): string {
  return join(root, 'settings', 'credentials.json')
}

async function readStoredApiKey(root: string, cipher: CredentialCipher): Promise<string | null> {
  try {
    const stored = encryptedCredentialsSchema.parse(
      JSON.parse(await readFile(credentialsPath(root), 'utf8'))
    )
    if (!cipher.isAvailable()) throw new Error('Secure credential storage is unavailable.')
    return openAIApiKeySchema.parse(
      cipher.decrypt(Buffer.from(stored.openAIApiKey, 'base64')).trim()
    )
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function saveApiKey(
  root: string,
  rawApiKey: string,
  cipher: CredentialCipher
): Promise<ApiKeyStatus> {
  if (!cipher.isAvailable())
    throw new Error('Secure credential storage is unavailable on this Mac.')
  const apiKey = openAIApiKeySchema.parse(rawApiKey)
  const directory = join(root, 'settings')
  const destination = credentialsPath(root)
  const temporary = join(directory, `.credentials-${randomUUID()}.tmp`)
  const payload = {
    version: 1 as const,
    openAIApiKey: cipher.encrypt(apiKey).toString('base64')
  }

  await mkdir(directory, { recursive: true, mode: 0o700 })
  try {
    await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600
    })
    await rename(temporary, destination)
    await chmod(destination, 0o600)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }

  return { configured: true, source: 'app' }
}

export async function clearApiKey(
  root: string,
  environmentApiKey: string | undefined,
  cipher: CredentialCipher
): Promise<ApiKeyStatus> {
  await rm(credentialsPath(root), { force: true })
  return getApiKeyStatus(root, environmentApiKey, cipher)
}

export async function resolveApiKey(
  root: string,
  environmentApiKey: string | undefined,
  cipher: CredentialCipher
): Promise<{ apiKey: string | null; source: ApiKeyStatus['source'] }> {
  const stored = await readStoredApiKey(root, cipher)
  if (stored) return { apiKey: stored, source: 'app' }

  const environment = openAIApiKeySchema.safeParse(environmentApiKey)
  if (environment.success) return { apiKey: environment.data, source: 'environment' }
  return { apiKey: null, source: 'none' }
}

export async function getApiKeyStatus(
  root: string,
  environmentApiKey: string | undefined,
  cipher: CredentialCipher
): Promise<ApiKeyStatus> {
  const resolved = await resolveApiKey(root, environmentApiKey, cipher)
  return { configured: resolved.apiKey !== null, source: resolved.source }
}
