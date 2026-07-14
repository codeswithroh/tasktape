export interface ExtractedFrame {
  timestampMs: number
  dataUrl: string
  width: number
  height: number
}

export interface AnalyzeRecordingInput {
  recordingId: string
  durationMs: number
  frames: ExtractedFrame[]
}
