import { describe, expect, it } from 'vitest'

import { frameTimestamps } from './extractFrames'

describe('frameTimestamps', () => {
  it('uses one centered frame for a short recording', () => {
    expect(frameTimestamps(6_000)).toEqual([3_000])
  })

  it('spaces frames evenly and caps long recordings', () => {
    const timestamps = frameTimestamps(120_000, 8)
    expect(timestamps).toHaveLength(8)
    expect(timestamps[0]).toBe(13_333)
    expect(timestamps.at(-1)).toBe(106_667)
  })

  it('rejects invalid durations without producing work', () => {
    expect(frameTimestamps(0)).toEqual([])
    expect(frameTimestamps(Number.NaN)).toEqual([])
  })
})
