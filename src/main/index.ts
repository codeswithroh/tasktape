import { join } from 'node:path'

import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  session,
  shell,
  systemPreferences
} from 'electron'

import type { SaveRecordingInput } from '../shared/contracts.js'
import { recordingIdSchema } from '../shared/recording-schema.js'
import { removeRecording, saveRecording } from './recordings.js'

if (process.env.TASKTAPE_USER_DATA) {
  app.setPath('userData', process.env.TASKTAPE_USER_DATA)
}

function recordingsRoot(): string {
  return join(app.getPath('userData'), 'recordings')
}

function registerRecorderIpc(): void {
  ipcMain.handle('recorder:get-permission-status', () => {
    if (process.platform !== 'darwin') return 'unknown'
    return systemPreferences.getMediaAccessStatus('screen')
  })

  ipcMain.handle('recorder:save', (_event, input: SaveRecordingInput) => {
    return saveRecording(recordingsRoot(), input)
  })

  ipcMain.handle('recorder:remove', (_event, id: string) => {
    return removeRecording(recordingsRoot(), recordingIdSchema.parse(id))
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
  registerDisplayCapture()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
