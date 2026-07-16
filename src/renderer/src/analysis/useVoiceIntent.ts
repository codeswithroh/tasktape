import { useCallback, useEffect, useRef, useState } from 'react'

type VoiceIntentState = 'idle' | 'requesting' | 'listening' | 'transcribing' | 'ready' | 'error'

interface VoiceIntentController {
  state: VoiceIntentState
  transcript: string
  elapsedMs: number
  error: string | null
  start: () => Promise<void>
  stop: () => Promise<void>
  cancel: () => void
  setTranscript: (value: string) => void
  reset: () => void
}

function preferredAudioMimeType(): string {
  const options = ['audio/webm;codecs=opus', 'audio/webm']
  return options.find((value) => MediaRecorder.isTypeSupported(value)) ?? ''
}

function readableMicrophoneError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Microphone access is off. You can enable it in System Settings or type instead.'
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'No microphone is available. Connect one or type your description instead.'
  }
  return error instanceof Error ? error.message : 'The microphone could not start.'
}

export function useVoiceIntent(initialTranscript = ''): VoiceIntentController {
  const [state, setState] = useState<VoiceIntentState>('idle')
  const [transcript, setTranscriptState] = useState(initialTranscript)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const timerRef = useRef<number | null>(null)

  const stopTimer = useCallback((): void => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  const releaseStream = useCallback((): void => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  useEffect(
    () => () => {
      stopTimer()
      releaseStream()
    },
    [releaseStream, stopTimer]
  )

  const startTimer = useCallback((): void => {
    startedAtRef.current = Date.now()
    setElapsedMs(0)
    timerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current)
    }, 200)
  }, [])

  const start = useCallback(async (): Promise<void> => {
    setError(null)
    setState('requesting')
    try {
      if (window.tasktape.testMode) {
        startTimer()
        setState('listening')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      const mimeType = preferredAudioMimeType()
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 32_000
      })
      chunksRef.current = []
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      })
      recorderRef.current = recorder
      streamRef.current = stream
      recorder.start(250)
      startTimer()
      setState('listening')
    } catch (caught) {
      releaseStream()
      setError(readableMicrophoneError(caught))
      setState('error')
    }
  }, [releaseStream, startTimer])

  const transcribe = useCallback(async (blob: Blob): Promise<void> => {
    if (blob.size === 0) {
      setError('No speech was captured. Try again or type your description.')
      setState('error')
      return
    }
    setState('transcribing')
    try {
      const result = await window.tasktape.analysis.transcribe({
        data: await blob.arrayBuffer(),
        mimeType: blob.type || 'audio/webm'
      })
      setTranscriptState(result.text)
      setState('ready')
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'TaskTape could not transcribe that note.'
      )
      setState('error')
    }
  }, [])

  const stop = useCallback(async (): Promise<void> => {
    if (state !== 'listening') return
    stopTimer()
    setElapsedMs(Date.now() - startedAtRef.current)

    if (window.tasktape.testMode) {
      await transcribe(new Blob(['TaskTape test voice note'], { type: 'audio/webm' }))
      return
    }

    const recorder = recorderRef.current
    if (!recorder) return
    const complete = new Promise<Blob>((resolve) => {
      recorder.addEventListener(
        'stop',
        () => {
          resolve(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }))
        },
        { once: true }
      )
    })
    recorder.stop()
    const blob = await complete
    recorderRef.current = null
    releaseStream()
    await transcribe(blob)
  }, [releaseStream, state, stopTimer, transcribe])

  const cancel = useCallback((): void => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    recorderRef.current = null
    chunksRef.current = []
    stopTimer()
    releaseStream()
    setElapsedMs(0)
    setError(null)
    setState(transcript ? 'ready' : 'idle')
  }, [releaseStream, stopTimer, transcript])

  const setTranscript = useCallback((value: string): void => {
    setTranscriptState(value)
    setError(null)
    setState(value.trim() ? 'ready' : 'idle')
  }, [])

  const reset = useCallback((): void => {
    cancel()
    setTranscriptState('')
    setState('idle')
  }, [cancel])

  return { state, transcript, elapsedMs, error, start, stop, cancel, setTranscript, reset }
}
