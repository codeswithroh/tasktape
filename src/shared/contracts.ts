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

export interface TaskTapeBridge {
  appInfo: AppInfo
  testMode: boolean
  recorder: {
    getPermissionStatus: () => Promise<ScreenPermissionStatus>
    save: (input: SaveRecordingInput) => Promise<RecordingMetadata>
    remove: (id: string) => Promise<void>
  }
  analysis: {
    analyze: (input: AnalyzeRecordingInput) => Promise<WorkflowAnalysis>
  }
}
import type { AnalyzeRecordingInput } from './analysis-contracts.js'
import type { WorkflowAnalysis } from './analysis-schema.js'
