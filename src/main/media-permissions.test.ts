import { describe, expect, it } from 'vitest'

import { isAllowedMediaRequest } from './media-permissions.js'

describe('desktop media permissions', () => {
  it('allows display capture and microphone without granting camera access', () => {
    expect(isAllowedMediaRequest('display-capture', undefined)).toBe(true)
    expect(isAllowedMediaRequest('media', [])).toBe(true)
    expect(isAllowedMediaRequest('media', ['audio'])).toBe(true)
    expect(isAllowedMediaRequest('media', ['video'])).toBe(false)
    expect(isAllowedMediaRequest('media', ['audio', 'video'])).toBe(false)
  })
})
