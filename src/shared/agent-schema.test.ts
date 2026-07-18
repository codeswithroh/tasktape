import { describe, expect, it } from 'vitest'

import {
  browserSelectorSchema,
  browserUrlSchema,
  pressKeyInputSchema,
  waitForInputSchema
} from './agent-schema.js'

describe('agent debugging contracts', () => {
  it('accepts local development URLs and rejects remote or credentialed URLs', () => {
    expect(browserUrlSchema.parse('http://127.0.0.1:4173/bug')).toBe('http://127.0.0.1:4173/bug')
    expect(browserUrlSchema.parse('https://localhost:3000')).toBe('https://localhost:3000')
    expect(() => browserUrlSchema.parse('https://example.com')).toThrow(/local HTTP or HTTPS/)
    expect(() => browserUrlSchema.parse('http://user:secret@localhost:3000')).toThrow(
      /local HTTP or HTTPS/
    )
  })

  it('requires one accessible selector strategy', () => {
    expect(browserSelectorSchema.parse({ role: 'button', name: 'Save asset' })).toEqual({
      role: 'button',
      name: 'Save asset'
    })
    expect(() => browserSelectorSchema.parse({ role: 'button', text: 'Save asset' })).toThrow(
      /exactly one selector strategy/
    )
    expect(() => browserSelectorSchema.parse({ name: 'Save asset' })).toThrow(
      /name can only be used with a role/i
    )
  })

  it('bounds waits and key chords', () => {
    expect(waitForInputSchema.parse({ milliseconds: 500 })).toEqual({ milliseconds: 500 })
    expect(waitForInputSchema.parse({ text: 'Saved assets' })).toEqual({ text: 'Saved assets' })
    expect(() => waitForInputSchema.parse({ milliseconds: 10_000 })).toThrow()
    expect(() => waitForInputSchema.parse({ text: 'Ready', milliseconds: 500 })).toThrow()
    expect(pressKeyInputSchema.parse({ key: 'Control+K' })).toEqual({ key: 'Control+K' })
    expect(() => pressKeyInputSchema.parse({ key: 'Control K' })).toThrow()
  })
})
