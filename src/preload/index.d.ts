import type { TaskTapeBridge } from '../shared/contracts'

declare global {
  interface Window {
    tasktape: TaskTapeBridge
  }
}

export {}
