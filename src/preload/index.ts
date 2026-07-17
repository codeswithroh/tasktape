import { contextBridge, ipcRenderer } from 'electron'

import type { AnalyzeRecordingInput, TranscribeIntentInput } from '../shared/analysis-contracts.js'
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
    openMicrophoneSettings: () => ipcRenderer.invoke('recorder:open-microphone-settings'),
    listSources: () => ipcRenderer.invoke('recorder:list-sources'),
    selectSource: (id: string) => ipcRenderer.invoke('recorder:select-source', id),
    save: (input: SaveRecordingInput) => ipcRenderer.invoke('recorder:save', input),
    remove: (id: string) => ipcRenderer.invoke('recorder:remove', id)
  },
  analysis: {
    transcribe: (input: TranscribeIntentInput) =>
      ipcRenderer.invoke('analysis:transcribe-intent', input),
    analyze: (input: AnalyzeRecordingInput) => ipcRenderer.invoke('analysis:analyze', input)
  },
  settings: {
    getApiKeyStatus: () => ipcRenderer.invoke('settings:get-api-key-status'),
    saveApiKey: (apiKey: string) => ipcRenderer.invoke('settings:save-api-key', apiKey),
    clearApiKey: () => ipcRenderer.invoke('settings:clear-api-key')
  },
  workflow: {
    chooseDirectory: () => ipcRenderer.invoke('workflow:choose-directory'),
    save: (input, existingId) => ipcRenderer.invoke('workflow:save', input, existingId),
    plan: (workflowId) => ipcRenderer.invoke('workflow:plan', workflowId),
    execute: (input) => ipcRenderer.invoke('workflow:execute', input),
    runTask: (workflowId) => ipcRenderer.invoke('workflow:run-task', workflowId),
    saveSchedule: (input) => ipcRenderer.invoke('workflow:save-schedule', input),
    scheduled: () => ipcRenderer.invoke('workflow:scheduled'),
    setScheduleEnabled: (input) => ipcRenderer.invoke('workflow:set-schedule-enabled', input),
    history: () => ipcRenderer.invoke('workflow:history')
  }
}

contextBridge.exposeInMainWorld('tasktape', bridge)
