import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { config } from 'dotenv'
import {
  app,
  BrowserWindow,
  desktopCapturer,
  type IpcMainInvokeEvent,
  ipcMain,
  safeStorage,
  session,
  shell,
  systemPreferences
} from 'electron'

import type { SaveRecordingInput } from '../shared/contracts.js'
import type { AnalyzeRecordingInput } from '../shared/analysis-contracts.js'
import { recordingIdSchema } from '../shared/recording-schema.js'
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

const credentialCipher: CredentialCipher = {
  isAvailable: () => safeStorage.isEncryptionAvailable(),
  encrypt: (plainText) => safeStorage.encryptString(plainText),
  decrypt: (encrypted) => safeStorage.decryptString(encrypted)
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

function registerDisplayCapture(): void {
  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: false
      })
      callback({ video: sources[0] })
    },
    { useSystemPicker: true }
  )
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
  registerDisplayCapture()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
