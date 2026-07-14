import { useCallback, useState } from 'react'

import type { ExtractedFrame } from '../../../shared/analysis-contracts'
import type { WorkflowAnalysis } from '../../../shared/analysis-schema'
import type { RecordingMetadata } from '../../../shared/contracts'

type AnalysisState = 'idle' | 'analyzing' | 'ready' | 'error'

interface AnalysisController {
  state: AnalysisState
  result: WorkflowAnalysis | null
  error: string | null
  analyze: (recording: RecordingMetadata, frames: ExtractedFrame[]) => Promise<void>
  reset: () => void
}

function readableError(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'TaskTape could not analyze this recording.'
}

export function useAnalysis(): AnalysisController {
  const [state, setState] = useState<AnalysisState>('idle')
  const [result, setResult] = useState<WorkflowAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  const analyze = useCallback(
    async (recording: RecordingMetadata, frames: ExtractedFrame[]): Promise<void> => {
      if (frames.length === 0) {
        setError('No key frames are available for analysis.')
        setState('error')
        return
      }

      setError(null)
      setState('analyzing')
      try {
        const analysis = await window.tasktape.analysis.analyze({
          recordingId: recording.id,
          durationMs: recording.durationMs,
          frames
        })
        setResult(analysis)
        setState('ready')
      } catch (caught) {
        setError(readableError(caught))
        setState('error')
      }
    },
    []
  )

  const reset = useCallback(() => {
    setState('idle')
    setResult(null)
    setError(null)
  }, [])

  return { state, result, error, analyze, reset }
}
