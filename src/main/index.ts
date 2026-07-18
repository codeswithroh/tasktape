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
import type { AnalyzeRecordingInput, TranscribeIntentInput } from '../shared/analysis-contracts.js'
import { captureSourceIdSchema } from '../shared/capture-source-schema.js'
import { recordingIdSchema } from '../shared/recording-schema.js'
import type {
  SaveScheduleInput,
  SaveWorkflowInput,
  SetScheduleEnabledInput
} from '../shared/workflow-schema.js'
import {
  analyzeRecording,
  requestOpenAIAnalysis,
  requestOpenAITranscription,
  transcribeIntent
} from './analysis.js'
import { TEST_COMPUTER_WORKFLOW_ANALYSIS, TEST_WORKFLOW_ANALYSIS } from './analysis-fixture.js'
import {
  clearApiKey,
  type CredentialCipher,
  getApiKeyStatus,
  resolveApiKey,
  saveApiKey
} from './api-credentials.js'
import { isAllowedMediaRequest } from './media-permissions.js'
import { requestOpenAIComputerResponse, runComputerAgent } from './computer-agent.js'
import { createMacOSInputHarness } from './macos-input.js'
import { evaluateComputerOutcome, requestOpenAIOutcomeEvaluation } from './outcome-evaluator.js'
import { removeRecording, saveRecording } from './recordings.js'
import {
  type ComputerTaskResult,
  createWorkflowPlan,
  executeComputerTask,
  executeWorkflowPlan,
  listScheduledTasks,
  listWorkflowHistory,
  readWorkflow,
  runDueSchedules,
  saveWorkflow,
  saveWorkflowSchedule,
  setWorkflowScheduleEnabled
} from './workflows.js'

if (!app.isPackaged) {
  config({
    path: [resolve(process.cwd(), '.env.local'), resolve(process.cwd(), '.env')],
    quiet: true
  })
}

if (process.env.TASKTAPE_USER_DATA) {
  app.setPath('userData', process.env.TASKTAPE_USER_DATA)
}

const hasSingleInstanceLock = process.env.TASKTAPE_E2E === '1' || app.requestSingleInstanceLock()

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
const TEST_RESULT_SCREENSHOT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZxnEAAAAASUVORK5CYII='
const TEST_INTENT_TRANSCRIPT =
  'Organize new assets using the structure I demonstrated every Monday at 9 AM, and leave anything unmatched in place.'

async function runComputerWorkflow(
  workflow: Extract<Awaited<ReturnType<typeof readWorkflow>>, { capability: 'computer' }>
): Promise<ComputerTaskResult> {
  if (process.env.TASKTAPE_E2E === '1') {
    const verificationStatus =
      process.env.TASKTAPE_E2E_VERIFICATION === 'failed' ? 'failed' : 'passed'
    return {
      output: 'Computer task completed.',
      actionLog: ['Completed the recorded computer task'],
      verification: workflow.expectedOutcome
        ? {
            status: verificationStatus,
            expectedOutcome: workflow.expectedOutcome,
            summary:
              verificationStatus === 'passed'
                ? 'The expected result is visible.'
                : 'The saved item does not retain the expected category.',
            evidence: [
              verificationStatus === 'passed'
                ? 'The saved item retains the Video category.'
                : 'The saved item is labeled Uncategorized.'
            ],
            screenshotDataUrl: TEST_RESULT_SCREENSHOT
          }
        : null
    }
  }
  const credential = await resolveApiKey(
    app.getPath('userData'),
    process.env.OPENAI_API_KEY,
    credentialCipher
  )
  if (!credential.apiKey) throw new Error('Add an OpenAI API key in Settings before running.')

  const taskTapeWindow = BrowserWindow.getAllWindows()[0]
  const wasVisible = taskTapeWindow?.isVisible() ?? false
  taskTapeWindow?.hide()
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
  try {
    const result = await runComputerAgent({
      task: workflow.instructions,
      harness: createMacOSInputHarness({
        targetApp: workflow.targetApp ?? undefined
      }),
      provider: (request) => requestOpenAIComputerResponse(request, credential.apiKey ?? undefined),
      onProgress:
        process.env.TASKTAPE_LIVE_COMPUTER === '1'
          ? (event) => process.stderr.write(`TaskTape computer: ${event}\n`)
          : undefined
    })
    const verification = workflow.expectedOutcome
      ? await evaluateComputerOutcome(
          {
            expectedOutcome: workflow.expectedOutcome,
            screenshotDataUrl: result.finalScreenshot
          },
          (input) => requestOpenAIOutcomeEvaluation(input, credential.apiKey ?? undefined)
        )
      : null
    return {
      output: result.output,
      actionLog: result.actionLog,
      verification: verification
        ? {
            ...verification,
            expectedOutcome: workflow.expectedOutcome ?? '',
            screenshotDataUrl: result.finalScreenshot
          }
        : null
    }
  } finally {
    if (wasVisible) {
      taskTapeWindow?.show()
      taskTapeWindow?.focus()
    }
  }
}

async function runSavedTask(workflowId: string, trigger: 'manual' | 'schedule' = 'manual') {
  const workflow = await readWorkflow(workflowsRoot(), workflowId)
  if (workflow.capability === 'computer') {
    return executeComputerTask(workflowsRoot(), workflow.id, runComputerWorkflow, trigger)
  }
  const plan = await createWorkflowPlan(workflowsRoot(), workflow.id)
  return executeWorkflowPlan(workflowsRoot(), { workflowId: workflow.id, planId: plan.id }, trigger)
}
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

function isTrustedRendererUrl(senderUrl: string | undefined): boolean {
  const developmentUrl = process.env.ELECTRON_RENDERER_URL
  try {
    return developmentUrl
      ? new URL(senderUrl ?? '').origin === new URL(developmentUrl).origin
      : senderUrl === pathToFileURL(join(__dirname, '../renderer/index.html')).href
  } catch {
    return false
  }
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  if (!isTrustedRendererUrl(event.senderFrame?.url)) {
    throw new Error('Rejected IPC request from an untrusted renderer')
  }
}

function registerRecorderIpc(): void {
  ipcMain.handle('recorder:get-permission-status', (event) => {
    assertTrustedSender(event)
    if (process.platform !== 'darwin') return 'unknown'
    return systemPreferences.getMediaAccessStatus('screen')
  })

  ipcMain.handle('recorder:open-microphone-settings', async (event) => {
    assertTrustedSender(event)
    if (process.platform === 'darwin') {
      await shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
      )
    }
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

function registerMediaPermissions(): void {
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    const trustedRenderer = isTrustedRendererUrl(contents.getURL())
    const mediaTypes = 'mediaTypes' in details ? details.mediaTypes : undefined
    callback(trustedRenderer && isAllowedMediaRequest(permission, mediaTypes))
  })
}

function registerAnalysisIpc(): void {
  ipcMain.handle('analysis:transcribe-intent', async (event, input: TranscribeIntentInput) => {
    assertTrustedSender(event)
    if (process.env.TASKTAPE_E2E === '1') {
      return transcribeIntent(input, async () => TEST_INTENT_TRANSCRIPT)
    }
    const credential = await resolveApiKey(
      app.getPath('userData'),
      process.env.OPENAI_API_KEY,
      credentialCipher
    )
    if (!credential.apiKey) {
      throw new Error('Add an OpenAI API key in Settings before transcribing intent.')
    }
    return transcribeIntent(input, (validatedInput) =>
      requestOpenAITranscription(validatedInput, credential.apiKey ?? undefined)
    )
  })

  ipcMain.handle('analysis:analyze', async (event, input: AnalyzeRecordingInput) => {
    assertTrustedSender(event)
    if (process.env.TASKTAPE_E2E === '1') {
      const fixture =
        process.env.TASKTAPE_E2E_ANALYSIS === 'computer'
          ? TEST_COMPUTER_WORKFLOW_ANALYSIS
          : TEST_WORKFLOW_ANALYSIS
      return analyzeRecording(input, async () => fixture)
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
    if (process.env.TASKTAPE_E2E === '1' && process.env.TASKTAPE_E2E_NATIVE_DIRECTORY !== '1') {
      if (process.env.TASKTAPE_E2E_DIRECTORY_MODE === 'cancel') return null
      return join(app.getPath('userData'), 'media-inbox')
    }
    const owner = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Choose the folder TaskTape can access',
      properties: ['openDirectory', 'createDirectory']
    }
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
  ipcMain.handle('workflow:save', (event, input: SaveWorkflowInput, existingId?: string) => {
    assertTrustedSender(event)
    return saveWorkflow(workflowsRoot(), input, existingId)
  })
  ipcMain.handle('workflow:plan', (event, workflowId: string) => {
    assertTrustedSender(event)
    return createWorkflowPlan(workflowsRoot(), workflowId)
  })
  ipcMain.handle('workflow:execute', (event, input: { workflowId: string; planId: string }) => {
    assertTrustedSender(event)
    return executeWorkflowPlan(workflowsRoot(), input)
  })
  ipcMain.handle('workflow:run-task', (event, workflowId: string) => {
    assertTrustedSender(event)
    return runSavedTask(workflowId)
  })
  ipcMain.handle('workflow:save-schedule', (event, input: SaveScheduleInput) => {
    assertTrustedSender(event)
    return saveWorkflowSchedule(workflowsRoot(), input)
  })
  ipcMain.handle('workflow:scheduled', (event) => {
    assertTrustedSender(event)
    return listScheduledTasks(workflowsRoot())
  })
  ipcMain.handle('workflow:set-schedule-enabled', (event, input: SetScheduleEnabledInput) => {
    assertTrustedSender(event)
    return setWorkflowScheduleEnabled(workflowsRoot(), input)
  })
  ipcMain.handle('workflow:history', (event) => {
    assertTrustedSender(event)
    return listWorkflowHistory(workflowsRoot())
  })
}

let schedulerTimer: NodeJS.Timeout | null = null
let schedulerRunning = false

function startWorkflowScheduler(): void {
  const tick = (): void => {
    if (schedulerRunning) return
    schedulerRunning = true
    void runDueSchedules(workflowsRoot(), new Date(), runComputerWorkflow)
      .catch((error: unknown) => {
        process.stderr.write(
          `TaskTape scheduler error: ${error instanceof Error ? error.message : 'Unknown error'}\n`
        )
      })
      .finally(() => {
        schedulerRunning = false
      })
  }
  tick()
  const testInterval = Number(process.env.TASKTAPE_E2E_SCHEDULER_INTERVAL_MS)
  const interval = process.env.TASKTAPE_E2E === '1' && testInterval >= 50 ? testInterval : 30_000
  schedulerTimer = setInterval(tick, interval)
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

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0]
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  })

  app.whenReady().then(() => {
    registerRecorderIpc()
    registerAnalysisIpc()
    registerSettingsIpc()
    registerWorkflowIpc()
    registerDisplayCapture()
    registerMediaPermissions()
    startWorkflowScheduler()
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('before-quit', () => {
    if (schedulerTimer) clearInterval(schedulerTimer)
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
