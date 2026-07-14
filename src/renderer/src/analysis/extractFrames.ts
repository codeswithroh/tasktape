import type { ExtractedFrame } from '../../../shared/analysis-contracts'

const DEFAULT_MAX_FRAMES = 8
const DEFAULT_MAX_WIDTH = 1280

export function frameTimestamps(durationMs: number, maxFrames = DEFAULT_MAX_FRAMES): number[] {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return []

  const count = Math.min(maxFrames, Math.max(1, Math.ceil(durationMs / 10_000)))
  return Array.from({ length: count }, (_, index) =>
    Math.round((durationMs * (index + 1)) / (count + 1))
  )
}

function waitForEvent(
  target: HTMLMediaElement,
  eventName: 'loadedmetadata' | 'seeked'
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out while waiting for video ${eventName}.`))
    }, 8_000)
    const onEvent = (): void => {
      cleanup()
      resolve()
    }
    const onError = (): void => {
      cleanup()
      reject(new Error('The saved recording could not be decoded.'))
    }
    const cleanup = (): void => {
      window.clearTimeout(timeout)
      target.removeEventListener(eventName, onEvent)
      target.removeEventListener('error', onError)
    }

    target.addEventListener(eventName, onEvent, { once: true })
    target.addEventListener('error', onError, { once: true })
  })
}

export async function extractFrames(
  recording: Blob,
  durationMs: number,
  options: { maxFrames?: number; maxWidth?: number } = {}
): Promise<ExtractedFrame[]> {
  const timestamps = frameTimestamps(durationMs, options.maxFrames)
  if (timestamps.length === 0) throw new Error('The recording duration is not valid.')

  const video = document.createElement('video')
  const sourceUrl = URL.createObjectURL(recording)
  video.muted = true
  video.preload = 'auto'
  video.src = sourceUrl

  try {
    if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
      await waitForEvent(video, 'loadedmetadata')
    }

    const sourceWidth = video.videoWidth
    const sourceHeight = video.videoHeight
    if (sourceWidth === 0 || sourceHeight === 0) {
      throw new Error('The recording does not contain a visible video track.')
    }

    const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH
    const scale = Math.min(1, maxWidth / sourceWidth)
    const width = Math.max(1, Math.round(sourceWidth * scale))
    const height = Math.max(1, Math.round(sourceHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('TaskTape could not create the frame extraction surface.')

    const frames: ExtractedFrame[] = []
    for (const timestampMs of timestamps) {
      const seeked = waitForEvent(video, 'seeked')
      video.currentTime = Math.min(timestampMs / 1_000, Math.max(0, durationMs / 1_000 - 0.01))
      await seeked
      context.drawImage(video, 0, 0, width, height)
      frames.push({
        timestampMs,
        dataUrl: canvas.toDataURL('image/jpeg', 0.78),
        width,
        height
      })
    }

    return frames
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(sourceUrl)
  }
}
