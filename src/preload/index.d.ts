import type { AppInfo } from '../shared/contracts'

declare global {
  interface Window {
    tasktape: { appInfo: AppInfo }
  }
}

export {}
