import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import type { Display, NativeImage } from 'electron'
import type { ComputerAction } from 'openai/resources/responses/responses'

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
  ensureHelper(cacheDir: string): Promise<string>
  runHelper(executablePath: string, args: string[]): Promise<void>
  activateApplication(targetApp: string): Promise<void>
}

export interface MacOSInputOptions {
  cacheDir: string
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

export function createMacOSInputHarness(options: MacOSInputOptions): ComputerHarness {
  if (process.platform !== 'darwin' && !options.dependencies) {
    throw new Error('The macOS computer harness can only run on macOS.')
  }
  if (!isAbsolute(options.cacheDir)) {
    throw new Error('The helper cache directory must be an absolute path.')
  }

  const dependencies: MacOSInputDependencies = {
    capturePrimaryScreen,
    getPrimaryDisplay,
    ensureHelper: ensureMacOSInputHelper,
    runHelper,
    activateApplication,
    ...options.dependencies
  }

  return {
    captureScreenshot: dependencies.capturePrimaryScreen,
    activateTarget: options.targetApp
      ? () => dependencies.activateApplication(options.targetApp as string)
      : undefined,
    async execute(action) {
      if (action.type === 'screenshot') {
        await dependencies.capturePrimaryScreen()
        return
      }

      const bounds = await dependencies.getPrimaryDisplay()
      const args = actionArguments(action, bounds)
      const executablePath = await dependencies.ensureHelper(options.cacheDir)
      await dependencies.runHelper(executablePath, args)
    }
  }
}

function actionArguments(action: ComputerAction, bounds: DisplayBounds): string[] {
  const point = (x: number, y: number): [string, string] => {
    validateCoordinate(x, y, bounds)
    return [String(x + bounds.originX), String(y + bounds.originY)]
  }

  switch (action.type) {
    case 'click':
      if (!['left', 'right', 'wheel', 'back', 'forward'].includes(action.button)) {
        throw new Error(`Unsupported mouse button: ${String(action.button)}`)
      }
      return ['click', ...point(action.x, action.y), action.button, ...(action.keys ?? [])]
    case 'double_click':
      return ['double_click', ...point(action.x, action.y), ...(action.keys ?? [])]
    case 'move':
      return ['move', ...point(action.x, action.y), ...(action.keys ?? [])]
    case 'scroll':
      return [
        'scroll',
        ...point(action.x, action.y),
        String(validScrollDistance(action.scroll_x)),
        String(validScrollDistance(action.scroll_y)),
        ...(action.keys ?? [])
      ]
    case 'drag': {
      if (action.path.length < 2 || action.path.length > MAX_DRAG_POINTS) {
        throw new RangeError(`A drag path must contain 2 to ${MAX_DRAG_POINTS} points.`)
      }
      const path = action.path.map(({ x, y }) => point(x, y).join(',')).join(';')
      return ['drag', path, ...(action.keys ?? [])]
    }
    case 'keypress':
      if (action.keys.length < 1 || action.keys.length > 8) {
        throw new RangeError('A keypress must contain 1 to 8 keys.')
      }
      return ['keypress', ...action.keys.map(validateKey)]
    case 'type':
      if (action.text.length > MAX_TYPED_TEXT_LENGTH) {
        throw new RangeError(`Typed text cannot exceed ${MAX_TYPED_TEXT_LENGTH} characters.`)
      }
      return ['type', action.text]
    case 'wait':
      return ['wait']
    case 'screenshot':
      return ['screenshot']
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
  return key
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

async function ensureMacOSInputHelper(cacheDir: string): Promise<string> {
  const directory = resolve(cacheDir)
  const sourcePath = join(directory, 'tasktape-input.swift')
  const executablePath = join(directory, 'tasktape-input')
  await mkdir(directory, { recursive: true, mode: 0o700 })

  let currentSource = ''
  try {
    currentSource = await readFile(sourcePath, 'utf8')
  } catch {
    // The helper has not been compiled in this cache yet.
  }

  if (currentSource !== SWIFT_INPUT_HELPER) {
    await writeFile(sourcePath, SWIFT_INPUT_HELPER, { encoding: 'utf8', mode: 0o600 })
    await runProcess('/usr/bin/xcrun', ['swiftc', '-O', sourcePath, '-o', executablePath])
  } else {
    try {
      await access(executablePath)
    } catch {
      await runProcess('/usr/bin/xcrun', ['swiftc', '-O', sourcePath, '-o', executablePath])
    }
  }
  return executablePath
}

async function runHelper(executablePath: string, args: string[]): Promise<void> {
  await runProcess(executablePath, args)
}

function runProcess(command: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'], shell: false })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-4_000)
    })
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`))
    })
  })
}

const SWIFT_INPUT_HELPER = String.raw`import ApplicationServices
import Foundation

enum InputError: Error, CustomStringConvertible {
    case invalid(String)
    var description: String {
        switch self { case .invalid(let message): return message }
    }
}

let keyCodes: [String: CGKeyCode] = [
    "A": 0, "S": 1, "D": 2, "F": 3, "H": 4, "G": 5, "Z": 6, "X": 7,
    "C": 8, "V": 9, "B": 11, "Q": 12, "W": 13, "E": 14, "R": 15,
    "Y": 16, "T": 17, "1": 18, "2": 19, "3": 20, "4": 21, "6": 22,
    "5": 23, "=": 24, "9": 25, "7": 26, "-": 27, "8": 28, "0": 29,
    "]": 30, "O": 31, "U": 32, "[": 33, "I": 34, "P": 35, "RETURN": 36,
    "ENTER": 36, "L": 37, "J": 38, "'": 39, "K": 40, ";": 41, "\\": 42,
    ",": 43, "/": 44, "N": 45, "M": 46, ".": 47, "TAB": 48, "SPACE": 49,
    "\u{0060}": 50, "BACKSPACE": 51, "ESC": 53, "ESCAPE": 53, "CMD": 55, "META": 55,
    "COMMAND": 55, "SHIFT": 56, "CAPSLOCK": 57, "OPTION": 58, "ALT": 58,
    "CTRL": 59, "CONTROL": 59, "RIGHTSHIFT": 60, "RIGHTOPTION": 61,
    "RIGHTCTRL": 62, "F17": 64, "DECIMAL": 65, "MULTIPLY": 67, "PLUS": 69,
    "CLEAR": 71, "VOLUMEUP": 72, "VOLUMEDOWN": 73, "MUTE": 74, "DIVIDE": 75,
    "NUMENTER": 76, "MINUS": 78, "F18": 79, "F19": 80, "NUMEQUAL": 81,
    "NUM0": 82, "NUM1": 83, "NUM2": 84, "NUM3": 85, "NUM4": 86,
    "NUM5": 87, "NUM6": 88, "NUM7": 89, "F20": 90, "NUM8": 91,
    "NUM9": 92, "F5": 96, "F6": 97, "F7": 98, "F3": 99, "F8": 100,
    "F9": 101, "F11": 103, "F13": 105, "F16": 106, "F14": 107,
    "F10": 109, "F12": 111, "F15": 113, "HELP": 114, "HOME": 115,
    "PAGEUP": 116, "DELETE": 117, "F4": 118, "END": 119, "F2": 120,
    "PAGEDOWN": 121, "F1": 122, "LEFT": 123, "ARROWLEFT": 123,
    "RIGHT": 124, "ARROWRIGHT": 124, "DOWN": 125, "ARROWDOWN": 125,
    "UP": 126, "ARROWUP": 126
]

func number(_ value: String, _ name: String) throws -> Double {
    guard let result = Double(value), result.isFinite else { throw InputError.invalid("Invalid \(name)") }
    return result
}

func point(_ x: String, _ y: String) throws -> CGPoint {
    CGPoint(x: try number(x, "x coordinate"), y: try number(y, "y coordinate"))
}

func code(_ name: String) throws -> CGKeyCode {
    guard let value = keyCodes[name.uppercased()] else { throw InputError.invalid("Unsupported key: \(name)") }
    return value
}

func flags(_ names: ArraySlice<String>) throws -> CGEventFlags {
    var result: CGEventFlags = []
    for name in names.map({ $0.uppercased() }) {
        switch name {
        case "CMD", "COMMAND", "META": result.insert(.maskCommand)
        case "SHIFT": result.insert(.maskShift)
        case "OPTION", "ALT": result.insert(.maskAlternate)
        case "CTRL", "CONTROL": result.insert(.maskControl)
        default: throw InputError.invalid("Unsupported modifier: \(name)")
        }
    }
    return result
}

func postMouse(_ type: CGEventType, _ location: CGPoint, _ button: CGMouseButton, _ modifiers: CGEventFlags = []) throws {
    guard let event = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: location, mouseButton: button) else {
        throw InputError.invalid("Could not create mouse event")
    }
    event.flags = modifiers
    event.post(tap: .cghidEventTap)
}

func button(_ name: String) -> (CGMouseButton, CGEventType, CGEventType) {
    switch name.lowercased() {
    case "right": return (.right, .rightMouseDown, .rightMouseUp)
    case "wheel": return (.center, .otherMouseDown, .otherMouseUp)
    case "back": return (CGMouseButton(rawValue: 3)!, .otherMouseDown, .otherMouseUp)
    case "forward": return (CGMouseButton(rawValue: 4)!, .otherMouseDown, .otherMouseUp)
    default: return (.left, .leftMouseDown, .leftMouseUp)
    }
}

func click(at location: CGPoint, name: String, count: Int, modifiers: CGEventFlags) throws {
    let (mouseButton, down, up) = button(name)
    for index in 1...count {
        guard let downEvent = CGEvent(mouseEventSource: nil, mouseType: down, mouseCursorPosition: location, mouseButton: mouseButton),
              let upEvent = CGEvent(mouseEventSource: nil, mouseType: up, mouseCursorPosition: location, mouseButton: mouseButton) else {
            throw InputError.invalid("Could not create click event")
        }
        downEvent.setIntegerValueField(.mouseEventClickState, value: Int64(index))
        upEvent.setIntegerValueField(.mouseEventClickState, value: Int64(index))
        downEvent.flags = modifiers
        upEvent.flags = modifiers
        downEvent.post(tap: .cghidEventTap)
        upEvent.post(tap: .cghidEventTap)
    }
}

func main() throws {
    let args = Array(CommandLine.arguments.dropFirst())
    guard let command = args.first else { throw InputError.invalid("Missing command") }
    switch command {
    case "click":
        guard args.count >= 4 else { throw InputError.invalid("click requires x, y, and button") }
        try click(at: point(args[1], args[2]), name: args[3], count: 1, modifiers: flags(args.dropFirst(4)))
    case "double_click":
        guard args.count >= 3 else { throw InputError.invalid("double_click requires x and y") }
        try click(at: point(args[1], args[2]), name: "left", count: 2, modifiers: flags(args.dropFirst(3)))
    case "move":
        guard args.count >= 3 else { throw InputError.invalid("move requires x and y") }
        try postMouse(.mouseMoved, point(args[1], args[2]), .left, flags(args.dropFirst(3)))
    case "drag":
        guard args.count >= 2 else { throw InputError.invalid("drag requires a path") }
        let points = try args[1].split(separator: ";").map { pair -> CGPoint in
            let values = pair.split(separator: ",")
            guard values.count == 2 else { throw InputError.invalid("Invalid drag point") }
            return try point(String(values[0]), String(values[1]))
        }
        guard points.count >= 2 else { throw InputError.invalid("drag requires two points") }
        let modifiers = try flags(args.dropFirst(2))
        try postMouse(.leftMouseDown, points[0], .left, modifiers)
        for location in points.dropFirst() { try postMouse(.leftMouseDragged, location, .left, modifiers) }
        try postMouse(.leftMouseUp, points.last!, .left, modifiers)
    case "scroll":
        guard args.count >= 5, let x = Int32(args[3]), let y = Int32(args[4]) else { throw InputError.invalid("Invalid scroll") }
        let location = try point(args[1], args[2])
        try postMouse(.mouseMoved, location, .left, flags(args.dropFirst(5)))
        guard let event = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 2, wheel1: y, wheel2: x, wheel3: 0) else {
            throw InputError.invalid("Could not create scroll event")
        }
        event.post(tap: .cghidEventTap)
    case "keypress":
        guard args.count >= 2 else { throw InputError.invalid("keypress requires keys") }
        let codes = try args.dropFirst().map(code)
        for value in codes { CGEvent(keyboardEventSource: nil, virtualKey: value, keyDown: true)?.post(tap: .cghidEventTap) }
        for value in codes.reversed() { CGEvent(keyboardEventSource: nil, virtualKey: value, keyDown: false)?.post(tap: .cghidEventTap) }
    case "type":
        guard args.count == 2 else { throw InputError.invalid("type requires text") }
        let units = Array(args[1].utf16)
        if units.isEmpty { return }
        guard let down = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: true),
              let up = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: false) else {
            throw InputError.invalid("Could not create keyboard event")
        }
        units.withUnsafeBufferPointer { buffer in
            down.keyboardSetUnicodeString(stringLength: units.count, unicodeString: buffer.baseAddress!)
            up.keyboardSetUnicodeString(stringLength: units.count, unicodeString: buffer.baseAddress!)
        }
        down.post(tap: .cghidEventTap)
        up.post(tap: .cghidEventTap)
    case "wait": Thread.sleep(forTimeInterval: 1.0)
    default: throw InputError.invalid("Unsupported command: \(command)")
    }
}

do { try main() } catch {
    FileHandle.standardError.write(Data("\(error)\n".utf8))
    exit(1)
}
`
