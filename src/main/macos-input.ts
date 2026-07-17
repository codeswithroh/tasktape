import { spawn } from 'node:child_process'
import type { Display, NativeImage } from 'electron'
import { Button, Key, Point, keyboard, mouse, sleep } from '@nut-tree-fork/nut-js'
import type { ComputerHarness } from './computer-agent.js'

export const MAX_TYPED_TEXT_LENGTH = 10_000
const MAX_DRAG_POINTS = 1_000

export interface DisplayBounds {
  width: number
  height: number
  originX: number
  originY: number
}

export interface MacOSInputDependencies {
  capturePrimaryScreen(): Promise<string>
  getPrimaryDisplay(): Promise<DisplayBounds>
  activateApplication(targetApp: string): Promise<void>
  moveMouse(x: number, y: number): Promise<void>
  clickMouse(button: 'left' | 'middle' | 'right', double: boolean): Promise<void>
  dragMouse(points: Array<{ x: number; y: number }>): Promise<void>
  scrollMouse(horizontal: number, vertical: number): Promise<void>
  pressKeys(keys: string[]): Promise<void>
  typeText(text: string): Promise<void>
  wait(): Promise<void>
}

export interface MacOSInputOptions {
  targetApp?: string
  dependencies?: Partial<MacOSInputDependencies>
}

export function validateCoordinate(x: number, y: number, bounds: DisplayBounds): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new RangeError('Computer coordinates must be finite numbers.')
  }
  if (x < 0 || y < 0 || x >= bounds.width || y >= bounds.height) {
    throw new RangeError(
      `Computer coordinate ${x},${y} is outside the ${bounds.width}x${bounds.height} display.`
    )
  }
}

export function createMacOSInputHarness(options: MacOSInputOptions = {}): ComputerHarness {
  if (process.platform !== 'darwin' && !options.dependencies) {
    throw new Error('The macOS computer harness can only run on macOS.')
  }

  const dependencies: MacOSInputDependencies = {
    capturePrimaryScreen,
    getPrimaryDisplay,
    activateApplication,
    moveMouse,
    clickMouse,
    dragMouse,
    scrollMouse,
    pressKeys,
    typeText,
    wait: () => sleep(1_000),
    ...options.dependencies
  }

  return {
    captureScreenshot: dependencies.capturePrimaryScreen,
    activateTarget: options.targetApp
      ? () => dependencies.activateApplication(options.targetApp as string)
      : undefined,
    async execute(action) {
      if (action.type === 'screenshot') {
        return
      }
      if (action.type === 'wait') {
        await dependencies.wait()
        return
      }
      if (action.type === 'type') {
        if (action.text.length > MAX_TYPED_TEXT_LENGTH) {
          throw new RangeError(`Typed text cannot exceed ${MAX_TYPED_TEXT_LENGTH} characters.`)
        }
        await dependencies.typeText(action.text)
        return
      }
      if (action.type === 'keypress') {
        if (action.keys.length < 1 || action.keys.length > 8) {
          throw new RangeError('A keypress must contain 1 to 8 keys.')
        }
        await dependencies.pressKeys(action.keys.map(validateKey))
        return
      }

      const bounds = await dependencies.getPrimaryDisplay()
      const point = (x: number, y: number): { x: number; y: number } => {
        validateCoordinate(x, y, bounds)
        return { x: x + bounds.originX, y: y + bounds.originY }
      }

      if (action.type === 'drag') {
        if (action.path.length < 2 || action.path.length > MAX_DRAG_POINTS) {
          throw new RangeError(`A drag path must contain 2 to ${MAX_DRAG_POINTS} points.`)
        }
        await dependencies.dragMouse(action.path.map(({ x, y }) => point(x, y)))
        return
      }

      const target = point(action.x, action.y)
      await dependencies.moveMouse(target.x, target.y)
      if (action.type === 'move') return
      if (action.type === 'scroll') {
        await dependencies.scrollMouse(
          validScrollDistance(action.scroll_x),
          validScrollDistance(action.scroll_y)
        )
        return
      }
      if (action.type === 'double_click') {
        await dependencies.clickMouse('left', true)
        return
      }
      if (!['left', 'right', 'wheel'].includes(action.button)) {
        throw new Error(`Unsupported mouse button: ${String(action.button)}`)
      }
      const button =
        action.button === 'left' ? 'left' : action.button === 'right' ? 'right' : 'middle'
      await dependencies.clickMouse(button, false)
    }
  }
}

function validScrollDistance(value: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new RangeError('Scroll distances must be finite integers.')
  }
  return Math.max(-10_000, Math.min(10_000, value))
}

function validateKey(key: string): string {
  if (!key || key.length > 30 || /[\0\r\n]/u.test(key)) {
    throw new Error('Computer key names must contain 1 to 30 printable characters.')
  }
  if (!(normalizeKey(key) in KEY_MAP)) throw new Error(`Unsupported key: ${key}`)
  return normalizeKey(key)
}

async function capturePrimaryScreen(): Promise<string> {
  const electron = await import('electron')
  const primaryDisplay = electron.screen.getPrimaryDisplay()
  const sources = await electron.desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: primaryDisplay.size
  })
  const source = sources.find(({ display_id }) => display_id === String(primaryDisplay.id))
  const thumbnail = (source ?? sources[0])?.thumbnail as NativeImage | undefined
  if (!thumbnail || thumbnail.isEmpty())
    throw new Error('The primary screen could not be captured.')
  return thumbnail.toDataURL()
}

async function getPrimaryDisplay(): Promise<DisplayBounds> {
  const electron = await import('electron')
  const display = electron.screen.getPrimaryDisplay() as Display
  return {
    width: display.bounds.width,
    height: display.bounds.height,
    originX: display.bounds.x,
    originY: display.bounds.y
  }
}

async function activateApplication(targetApp: string): Promise<void> {
  const appName = targetApp.trim()
  if (!appName || appName.length > 200 || /[\0\r\n]/u.test(appName)) {
    throw new Error('The target application name is invalid.')
  }
  await runProcess('/usr/bin/osascript', [
    '-e',
    'on run argv\nset targetName to item 1 of argv\ntell application "System Events" to set frontmost of first process whose name is targetName to true\nend run',
    '--',
    appName
  ])
}

async function moveMouse(x: number, y: number): Promise<void> {
  mouse.config.autoDelayMs = 0
  await mouse.setPosition(new Point(x, y))
}

async function clickMouse(button: 'left' | 'middle' | 'right', double: boolean): Promise<void> {
  const mapped = button === 'left' ? Button.LEFT : button === 'right' ? Button.RIGHT : Button.MIDDLE
  if (double) await mouse.doubleClick(mapped)
  else await mouse.click(mapped)
}

async function dragMouse(points: Array<{ x: number; y: number }>): Promise<void> {
  await mouse.drag(points.map(({ x, y }) => new Point(x, y)))
}

async function scrollMouse(horizontal: number, vertical: number): Promise<void> {
  if (horizontal > 0) await mouse.scrollRight(horizontal)
  if (horizontal < 0) await mouse.scrollLeft(Math.abs(horizontal))
  if (vertical > 0) await mouse.scrollDown(vertical)
  if (vertical < 0) await mouse.scrollUp(Math.abs(vertical))
}

async function pressKeys(keys: string[]): Promise<void> {
  const mapped = keys.map((key) => KEY_MAP[key])
  keyboard.config.autoDelayMs = 0
  await keyboard.pressKey(...mapped)
  await keyboard.releaseKey(...[...mapped].reverse())
}

async function typeText(text: string): Promise<void> {
  keyboard.config.autoDelayMs = 0
  await keyboard.type(text)
}

function normalizeKey(key: string): string {
  return key
    .toUpperCase()
    .replace(/^ARROW/, '')
    .replace('COMMAND', 'CMD')
    .replace('META', 'CMD')
}

const KEY_MAP: Record<string, Key> = {
  ALT: Key.LeftAlt,
  BACKSPACE: Key.Backspace,
  CMD: Key.LeftCmd,
  CONTROL: Key.LeftControl,
  CTRL: Key.LeftControl,
  DELETE: Key.Delete,
  DOWN: Key.Down,
  END: Key.End,
  ENTER: Key.Return,
  ESC: Key.Escape,
  ESCAPE: Key.Escape,
  HOME: Key.Home,
  LEFT: Key.Left,
  OPTION: Key.LeftAlt,
  PAGEDOWN: Key.PageDown,
  PAGEUP: Key.PageUp,
  RETURN: Key.Return,
  RIGHT: Key.Right,
  SHIFT: Key.LeftShift,
  SPACE: Key.Space,
  TAB: Key.Tab,
  UP: Key.Up
}

for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
  KEY_MAP[letter] = Key[letter as keyof typeof Key] as Key
}
for (let number = 0; number <= 9; number += 1) {
  KEY_MAP[String(number)] = Key[`Num${number}` as keyof typeof Key] as Key
}
for (let number = 1; number <= 20; number += 1) {
  KEY_MAP[`F${number}`] = Key[`F${number}` as keyof typeof Key] as Key
}

function runProcess(command: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'], shell: false })
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`${command} did not finish within 10 seconds.`))
    }, 10_000)
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-4_000)
    })
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolvePromise()
      else reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`))
    })
  })
}
