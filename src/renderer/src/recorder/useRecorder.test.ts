import { describe, expect, it } from 'vitest'

import { readableCaptureError } from './useRecorder'

describe('capture error copy', () => {
  it('distinguishes a rejected share from revoked system permission', () => {
    const rejection = new DOMException('Permission denied', 'NotAllowedError')

    expect(readableCaptureError(rejection, 'granted')).toContain('confirm the share')
    expect(readableCaptureError(rejection, 'denied')).toContain('System Settings')
  })
})
