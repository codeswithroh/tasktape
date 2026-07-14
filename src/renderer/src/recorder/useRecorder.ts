import { useCallback, useEffect, useRef, useState } from 'react'

import type { RecordingMetadata, ScreenPermissionStatus } from '../../../shared/contracts'
import type { ExtractedFrame } from '../../../shared/analysis-contracts'
import { extractFrames } from '../analysis/extractFrames'
import { requestCaptureStream, selectRecordingMimeType } from './capture'

export type RecorderState =
  'idle' | 'requesting' | 'recording' | 'saving' | 'extracting' | 'ready' | 'error'

interface RecorderController {
  state: RecorderState
  permissionStatus: ScreenPermissionStatus
  elapsedMs: number
  previewUrl: string | null
  metadata: RecordingMetadata | null
  frames: ExtractedFrame[]
  frameError: string | null
  error: string | null
  start: () => Promise<void>
  stop: () => void
  cancel: () => void
  discard: () => Promise<void>
}

function readableError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Screen recording was cancelled or blocked. Choose a screen or window to continue.'
  }
  if (error instanceof Error) return error.message
  return 'TaskTape could not complete the recording.'
}

export function useRecorder(): RecorderController {
  const [state, setState] = useState<RecorderState>('idle')
  const [permissionStatus, setPermissionStatus] = useState<ScreenPermissionStatus>('unknown')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<RecordingMetadata | null>(null)
  const [frames, setFrames] = useState<ExtractedFrame[]>([])
  const [frameError, setFrameError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const dispositionRef = useRef<'save' | 'discard'>('save')
  const timerRef = useRef<number | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
    setPreviewUrl(null)
  }, [])

  useEffect(() => {
    void window.tasktape.recorder.getPermissionStatus().then(setPermissionStatus)
    return () => {
      clearTimer()
      stopTracks()
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [clearTimer, stopTracks])

  const handleStopped = useCallback(
    async (mimeType: string) => {
      clearTimer()
      stopTracks()
      recorderRef.current = null

      if (dispositionRef.current === 'discard') {
        chunksRef.current = []
        setElapsedMs(0)
        setState('idle')
        return
      }

      try {
        setState('saving')
        const blob = new Blob(chunksRef.current, { type: mimeType })
        chunksRef.current = []
        const durationMs = Math.max(100, Date.now() - startedAtRef.current)
        const saved = await window.tasktape.recorder.save({
          data: await blob.arrayBuffer(),
          durationMs,
          mimeType
        })
        const url = URL.createObjectURL(blob)
        previewUrlRef.current = url
        setPreviewUrl(url)
        setMetadata(saved)
        setElapsedMs(durationMs)
        setState('extracting')
        try {
          setFrames(await extractFrames(blob, durationMs))
          setFrameError(null)
        } catch (caught) {
          setFrames([])
          setFrameError(readableError(caught))
        }
        setState('ready')
      } catch (caught) {
        setError(readableError(caught))
        setState('error')
      }
    },
    [clearTimer, stopTracks]
  )

  const start = useCallback(async () => {
    if (recorderRef.current || state === 'requesting' || state === 'saving') return
    revokePreview()
    setMetadata(null)
    setFrames([])
    setFrameError(null)
    setError(null)
    setElapsedMs(0)
    setState('requesting')

    try {
      const stream = await requestCaptureStream(window.tasktape.testMode)
      const mimeType = selectRecordingMimeType()
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2_500_000
      })

      streamRef.current = stream
      recorderRef.current = recorder
      chunksRef.current = []
      dispositionRef.current = 'save'
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => void handleStopped(mimeType)
      recorder.onerror = () => {
        setError('The screen recorder stopped unexpectedly.')
        setState('error')
      }

      recorder.start(250)
      startedAtRef.current = Date.now()
      timerRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current)
      }, 200)
      setPermissionStatus('granted')
      setState('recording')
    } catch (caught) {
      stopTracks()
      setError(readableError(caught))
      setState('error')
    }
  }, [handleStopped, revokePreview, state, stopTracks])

  const stop = useCallback(() => {
    if (recorderRef.current?.state !== 'recording') return
    dispositionRef.current = 'save'
    recorderRef.current.stop()
  }, [])

  const cancel = useCallback(() => {
    if (recorderRef.current?.state !== 'recording') return
    dispositionRef.current = 'discard'
    recorderRef.current.stop()
  }, [])

  const discard = useCallback(async () => {
    if (metadata) await window.tasktape.recorder.remove(metadata.id)
    revokePreview()
    setMetadata(null)
    setFrames([])
    setFrameError(null)
    setElapsedMs(0)
    setError(null)
    setState('idle')
  }, [metadata, revokePreview])

  return {
    state,
    permissionStatus,
    elapsedMs,
    previewUrl,
    metadata,
    frames,
    frameError,
    error,
    start,
    stop,
    cancel,
    discard
  }
}
