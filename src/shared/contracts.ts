export interface AppInfo {
  name: string
  version: string
  platform:
    | 'aix'
    | 'android'
    | 'darwin'
    | 'freebsd'
    | 'haiku'
    | 'linux'
    | 'openbsd'
    | 'sunos'
    | 'win32'
    | 'cygwin'
    | 'netbsd'
}

export const APP_NAME = 'TaskTape'

export type ScreenPermissionStatus =
  'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown'

export interface CaptureSource {
  id: string
  name: string
  kind: 'screen' | 'window'
  thumbnailUrl: string
  appIconUrl: string | null
}

export interface SaveRecordingInput {
  data: ArrayBuffer
  durationMs: number
  mimeType: string
}

export interface RecordingMetadata {
  id: string
  createdAt: string
  durationMs: number
  mimeType: string
  bytes: number
}

export interface ApiKeyStatus {
  configured: boolean
  source: 'app' | 'environment' | 'none'
}

export interface TaskTapeBridge {
  appInfo: AppInfo
  testMode: boolean
  recorder: {
    getPermissionStatus: () => Promise<ScreenPermissionStatus>
    openMicrophoneSettings: () => Promise<void>
    listSources: () => Promise<CaptureSource[]>
    selectSource: (id: string) => Promise<void>
    save: (input: SaveRecordingInput) => Promise<RecordingMetadata>
    remove: (id: string) => Promise<void>
  }
  analysis: {
    transcribe: (input: TranscribeIntentInput) => Promise<TranscribeIntentResult>
    analyze: (input: AnalyzeRecordingInput) => Promise<WorkflowAnalysis>
  }
  settings: {
    getApiKeyStatus: () => Promise<ApiKeyStatus>
    saveApiKey: (apiKey: string) => Promise<ApiKeyStatus>
    clearApiKey: () => Promise<ApiKeyStatus>
  }
  agent: {
    getStatus: () => Promise<AgentServerStatus>
  }
  workflow: {
    list: () => Promise<SavedWorkflow[]>
    chooseDirectory: () => Promise<string | null>
    save: (input: SaveWorkflowInput, existingId?: string) => Promise<SavedWorkflow>
    plan: (workflowId: string) => Promise<WorkflowPlan>
    execute: (input: { workflowId: string; planId: string }) => Promise<WorkflowRun>
    runTask: (workflowId: string) => Promise<WorkflowRun>
    saveSchedule: (input: SaveScheduleInput) => Promise<WorkflowSchedule>
    scheduled: () => Promise<ScheduledTask[]>
    setScheduleEnabled: (input: SetScheduleEnabledInput) => Promise<WorkflowSchedule>
    history: () => Promise<WorkflowHistoryEntry[]>
  }
}
import type {
  AnalyzeRecordingInput,
  TranscribeIntentInput,
  TranscribeIntentResult
} from './analysis-contracts.js'
import type { WorkflowAnalysis } from './analysis-schema.js'
import type { AgentServerStatus } from './agent-schema.js'
import type {
  SaveScheduleInput,
  SavedWorkflow,
  SaveWorkflowInput,
  ScheduledTask,
  SetScheduleEnabledInput,
  WorkflowHistoryEntry,
  WorkflowPlan,
  WorkflowRun,
  WorkflowSchedule
} from './workflow-schema.js'
