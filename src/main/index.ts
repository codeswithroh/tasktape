import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { config } from 'dotenv'
import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  type IpcMainInvokeEvent,
  ipcMain,
  safeStorage,
  session,
  shell,
  systemPreferences,
  webContents
} from 'electron'

import type { CaptureSource, SaveRecordingInput } from '../shared/contracts.js'
import type { AnalyzeRecordingInput } from '../shared/analysis-contracts.js'
import { captureSourceIdSchema } from '../shared/capture-source-schema.js'
import { recordingIdSchema } from '../shared/recording-schema.js'
import type { SaveWorkflowInput } from '../shared/workflow-schema.js'
import { analyzeRecording, requestOpenAIAnalysis } from './analysis.js'
import { TEST_WORKFLOW_ANALYSIS } from './analysis-fixture.js'
import {
  clearApiKey,
  type CredentialCipher,
  getApiKeyStatus,
  resolveApiKey,
  saveApiKey
} from './api-credentials.js'
import { removeRecording, saveRecording } from './recordings.js'
import { createWorkflowPlan, executeWorkflowPlan, saveWorkflow } from './workflows.js'

if (!app.isPackaged) {
  config({
    path: [resolve(process.cwd(), '.env.local'), resolve(process.cwd(), '.env')],
    quiet: true
  })
}

if (process.env.TASKTAPE_USER_DATA) {
  app.setPath('userData', process.env.TASKTAPE_USER_DATA)
}

function recordingsRoot(): string {
  return join(app.getPath('userData'), 'recordings')
}

function workflowsRoot(): string {
  return join(app.getPath('userData'), 'workflows')
}

const credentialCipher: CredentialCipher = {
  isAvailable: () => safeStorage.isEncryptionAvailable(),
  encrypt: (plainText) => safeStorage.encryptString(plainText),
  decrypt: (encrypted) => safeStorage.decryptString(encrypted)
}

const selectedCaptureSources = new Map<number, string>()
const TEST_CAPTURE_THUMBNAIL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
const TEST_CAPTURE_SOURCES: CaptureSource[] = [
  {
    id: 'screen:test:0',
    name: 'Entire screen',
    kind: 'screen',
    thumbnailUrl: TEST_CAPTURE_THUMBNAIL,
    appIconUrl: null
  },
  {
    id: 'window:test:finder',
    name: 'Downloads - Finder',
    kind: 'window',
    thumbnailUrl: TEST_CAPTURE_THUMBNAIL,
    appIconUrl: null
  },
  {
    id: 'window:test:browser',
    name: 'Creator dashboard - Browser',
    kind: 'window',
    thumbnailUrl: TEST_CAPTURE_THUMBNAIL,
    appIconUrl: null
  }
]

async function desktopSources(): Promise<Electron.DesktopCapturerSource[]> {
  return desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 360, height: 203 },
    fetchWindowIcons: true
  })
}

async function captureSources(): Promise<CaptureSource[]> {
  if (process.env.TASKTAPE_E2E === '1') return TEST_CAPTURE_SOURCES
  const sources = await desktopSources()
  return sources
    .map((source) => ({
      id: source.id,
      name: source.name,
      kind: source.id.startsWith('screen:') ? ('screen' as const) : ('window' as const),
      thumbnailUrl: source.thumbnail.toDataURL(),
      appIconUrl: source.appIcon?.toDataURL() ?? null
    }))
    .sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === 'screen' ? -1 : 1
      return left.name.localeCompare(right.name)
    })
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url
  const developmentUrl = process.env.ELECTRON_RENDERER_URL
  let isTrusted = false
  try {
    isTrusted = developmentUrl
      ? new URL(senderUrl ?? '').origin === new URL(developmentUrl).origin
      : senderUrl === pathToFileURL(join(__dirname, '../renderer/index.html')).href
  } catch {
    isTrusted = false
  }
  if (!isTrusted) throw new Error('Rejected IPC request from an untrusted renderer')
}

function registerRecorderIpc(): void {
  ipcMain.handle('recorder:get-permission-status', (event) => {
    assertTrustedSender(event)
    if (process.platform !== 'darwin') return 'unknown'
    return systemPreferences.getMediaAccessStatus('screen')
  })

  ipcMain.handle('recorder:list-sources', (event) => {
    assertTrustedSender(event)
    return captureSources()
  })

  ipcMain.handle('recorder:select-source', async (event, rawId: string) => {
    assertTrustedSender(event)
    const id = captureSourceIdSchema.parse(rawId)
    const sources = await captureSources()
    if (!sources.some((source) => source.id === id)) {
      throw new Error('That screen or window is no longer available.')
    }
    selectedCaptureSources.set(event.sender.id, id)
  })

  ipcMain.handle('recorder:save', (event, input: SaveRecordingInput) => {
    assertTrustedSender(event)
    return saveRecording(recordingsRoot(), input)
  })

  ipcMain.handle('recorder:remove', (event, id: string) => {
    assertTrustedSender(event)
    return removeRecording(recordingsRoot(), recordingIdSchema.parse(id))
  })
}

function registerAnalysisIpc(): void {
  ipcMain.handle('analysis:analyze', async (event, input: AnalyzeRecordingInput) => {
    assertTrustedSender(event)
    if (process.env.TASKTAPE_E2E === '1') {
      return analyzeRecording(input, async () => TEST_WORKFLOW_ANALYSIS)
    }
    const credential = await resolveApiKey(
      app.getPath('userData'),
      process.env.OPENAI_API_KEY,
      credentialCipher
    )
    if (!credential.apiKey) throw new Error('Add an OpenAI API key in Settings before analyzing.')
    return analyzeRecording(input, (validatedInput) =>
      requestOpenAIAnalysis(validatedInput, credential.apiKey ?? undefined)
    )
  })
}

function registerSettingsIpc(): void {
  ipcMain.handle('settings:get-api-key-status', (event) => {
    assertTrustedSender(event)
    return getApiKeyStatus(app.getPath('userData'), process.env.OPENAI_API_KEY, credentialCipher)
  })
  ipcMain.handle('settings:save-api-key', (event, apiKey: string) => {
    assertTrustedSender(event)
    return saveApiKey(app.getPath('userData'), apiKey, credentialCipher)
  })
  ipcMain.handle('settings:clear-api-key', (event) => {
    assertTrustedSender(event)
    return clearApiKey(app.getPath('userData'), process.env.OPENAI_API_KEY, credentialCipher)
  })
}

function registerWorkflowIpc(): void {
  ipcMain.handle('workflow:choose-directory', async (event) => {
    assertTrustedSender(event)
    const owner = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Choose the media folder',
      properties: ['openDirectory', 'createDirectory']
    }
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
  ipcMain.handle('workflow:save', (event, input: SaveWorkflowInput) => {
    assertTrustedSender(event)
    return saveWorkflow(workflowsRoot(), input)
  })
  ipcMain.handle('workflow:plan', (event, workflowId: string) => {
    assertTrustedSender(event)
    return createWorkflowPlan(workflowsRoot(), workflowId)
  })
  ipcMain.handle('workflow:execute', (event, input: { workflowId: string; planId: string }) => {
    assertTrustedSender(event)
    return executeWorkflowPlan(workflowsRoot(), input)
  })
}

function registerDisplayCapture(): void {
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    const owner = request.frame ? webContents.fromFrame(request.frame) : undefined
    const selectedId = owner ? selectedCaptureSources.get(owner.id) : undefined
    if (owner) selectedCaptureSources.delete(owner.id)
    if (!selectedId) {
      callback({})
      return
    }

    const selected = (await desktopSources()).find((source) => source.id === selectedId)
    callback(selected ? { video: selected } : {})
  })
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: '#F5F7F5',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.once('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).protocol === 'https:') void shell.openExternal(url)
    } catch {
      // Invalid and non-HTTPS URLs stay closed.
    }
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerRecorderIpc()
  registerAnalysisIpc()
  registerSettingsIpc()
  registerWorkflowIpc()
  registerDisplayCapture()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
