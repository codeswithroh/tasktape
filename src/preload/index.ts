import { contextBridge } from 'electron'

import type { AppInfo } from '../shared/contracts.js'
import { APP_NAME } from '../shared/contracts.js'

const appInfo: AppInfo = {
  name: APP_NAME,
  version: '0.1.0',
  platform: process.platform
}

contextBridge.exposeInMainWorld('tasktape', { appInfo })
