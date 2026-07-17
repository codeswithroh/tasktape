import { describe, expect, it, vi } from 'vitest'

import {
  MAX_TYPED_TEXT_LENGTH,
  createMacOSInputHarness,
  validateCoordinate,
  type MacOSInputDependencies
} from './macos-input.js'

const bounds = { width: 1440, height: 900, originX: 0, originY: 0 }

function dependencies(): MacOSInputDependencies {
  return {
    capturePrimaryScreen: vi.fn().mockResolvedValue('data:image/png;base64,c2NyZWVu'),
    getPrimaryDisplay: vi.fn().mockResolvedValue(bounds),
    activateApplication: vi.fn().mockResolvedValue(undefined),
    moveMouse: vi.fn().mockResolvedValue(undefined),
    clickMouse: vi.fn().mockResolvedValue(undefined),
    dragMouse: vi.fn().mockResolvedValue(undefined),
    scrollMouse: vi.fn().mockResolvedValue(undefined),
    pressKeys: vi.fn().mockResolvedValue(undefined),
    typeText: vi.fn().mockResolvedValue(undefined),
    wait: vi.fn().mockResolvedValue(undefined)
  }
}

describe('macOS input harness', () => {
  it('validates coordinates against the primary display', () => {
    expect(() => validateCoordinate(0, 0, bounds)).not.toThrow()
    expect(() => validateCoordinate(1439, 899, bounds)).not.toThrow()
    expect(() => validateCoordinate(-1, 20, bounds)).toThrow(RangeError)
    expect(() => validateCoordinate(1440, 20, bounds)).toThrow(
      'Computer coordinate 1440,20 is outside the 1440x900 display.'
    )
    expect(() => validateCoordinate(Number.NaN, 20, bounds)).toThrow(
      'Computer coordinates must be finite numbers.'
    )
  })

  it('rejects invalid coordinates before native input', async () => {
    const deps = dependencies()
    const harness = createMacOSInputHarness({ dependencies: deps })

    await expect(
      harness.execute({ type: 'click', button: 'left', x: 1440, y: 10 })
    ).rejects.toThrow(RangeError)
    expect(deps.moveMouse).not.toHaveBeenCalled()
    expect(deps.clickMouse).not.toHaveBeenCalled()
  })

  it('translates local coordinates and scrolls at the target point', async () => {
    const deps = dependencies()
    vi.mocked(deps.getPrimaryDisplay).mockResolvedValue({
      width: 1200,
      height: 800,
      originX: -1200,
      originY: 100
    })
    const harness = createMacOSInputHarness({ dependencies: deps })

    await harness.execute({ type: 'scroll', x: 100, y: 50, scroll_x: 4, scroll_y: -80 })

    expect(deps.moveMouse).toHaveBeenCalledWith(-1100, 150)
    expect(deps.scrollMouse).toHaveBeenCalledWith(4, -80)
  })

  it('caps typed text before invoking native input', async () => {
    const deps = dependencies()
    const harness = createMacOSInputHarness({ dependencies: deps })

    await expect(
      harness.execute({ type: 'type', text: 'x'.repeat(MAX_TYPED_TEXT_LENGTH + 1) })
    ).rejects.toThrow(`Typed text cannot exceed ${MAX_TYPED_TEXT_LENGTH} characters.`)
    expect(deps.typeText).not.toHaveBeenCalled()
  })

  it('uses injected screenshot, activation, and keyboard boundaries', async () => {
    const deps = dependencies()
    const harness = createMacOSInputHarness({ targetApp: 'Finder', dependencies: deps })

    await harness.activateTarget?.()
    await expect(harness.captureScreenshot()).resolves.toBe('data:image/png;base64,c2NyZWVu')
    await harness.execute({ type: 'screenshot' })
    await harness.execute({ type: 'keypress', keys: ['CMD', 'A'] })

    expect(deps.activateApplication).toHaveBeenCalledWith('Finder')
    expect(deps.capturePrimaryScreen).toHaveBeenCalledOnce()
    expect(deps.pressKeys).toHaveBeenCalledWith(['CMD', 'A'])
  })
})
