import { describe, expect, it } from 'vitest'

import { APP_NAME } from './contracts.js'

describe('shared contracts', () => {
  it('exposes the product name', () => {
    expect(APP_NAME).toBe('TaskTape')
  })
})
