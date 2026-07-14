import { join, resolve } from 'node:path'

import { config } from 'dotenv'
import {
  app,
  BrowserWindow,
  desktopCapturer,
  type IpcMainInvokeEvent,
  ipcMain,
  session,
  shell,
  systemPreferences
} from 'electron'

import type { SaveRecordingInput } from '../shared/contracts.js'
import type { AnalyzeRecordingInput } from '../shared/analysis-contracts.js'
import { recordingIdSchema } from '../shared/recording-schema.js'
import { analyzeRecording } from './analysis.js'
import { TEST_WORKFLOW_ANALYSIS } from './analysis-fixture.js'
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

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url
  const developmentUrl = process.env.ELECTRON_RENDERER_URL
  const isTrusted = developmentUrl
    ? senderUrl?.startsWith(developmentUrl)
    : senderUrl?.startsWith('file://')
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
  ipcMain.handle('analysis:analyze', (event, input: AnalyzeRecordingInput) => {
    assertTrustedSender(event)
    if (process.env.TASKTAPE_E2E === '1') {
      return analyzeRecording(input, async () => TEST_WORKFLOW_ANALYSIS)
    }
    return analyzeRecording(input)
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
    void shell.openExternal(url)
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
  registerDisplayCapture()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
