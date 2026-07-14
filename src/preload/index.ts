import { contextBridge, ipcRenderer } from 'electron'

import type { AnalyzeRecordingInput } from '../shared/analysis-contracts.js'
import type { AppInfo, SaveRecordingInput, TaskTapeBridge } from '../shared/contracts.js'
import { APP_NAME } from '../shared/contracts.js'

const appInfo: AppInfo = {
  name: APP_NAME,
  version: '0.1.0',
  platform: process.platform
}

const bridge: TaskTapeBridge = {
  appInfo,
  testMode: process.env.TASKTAPE_E2E === '1',
  recorder: {
    getPermissionStatus: () => ipcRenderer.invoke('recorder:get-permission-status'),
    save: (input: SaveRecordingInput) => ipcRenderer.invoke('recorder:save', input),
    remove: (id: string) => ipcRenderer.invoke('recorder:remove', id)
  },
  analysis: {
    analyze: (input: AnalyzeRecordingInput) => ipcRenderer.invoke('analysis:analyze', input)
  },
  settings: {
    getApiKeyStatus: () => ipcRenderer.invoke('settings:get-api-key-status'),
    saveApiKey: (apiKey: string) => ipcRenderer.invoke('settings:save-api-key', apiKey),
    clearApiKey: () => ipcRenderer.invoke('settings:clear-api-key')
  }
}

contextBridge.exposeInMainWorld('tasktape', bridge)
