import { describe, expect, it } from 'vitest'

import { APP_NAME } from './contracts.js'
import { captureSourceIdSchema } from './capture-source-schema.js'

describe('shared contracts', () => {
  it('exposes the product name', () => {
    expect(APP_NAME).toBe('TaskTape')
  })

  it('accepts only Electron screen and window source identifiers', () => {
    expect(captureSourceIdSchema.parse('screen:3:0')).toBe('screen:3:0')
    expect(captureSourceIdSchema.parse('window:2177:0')).toBe('window:2177:0')
    expect(() => captureSourceIdSchema.parse('camera:0')).toThrow()
  })
})
