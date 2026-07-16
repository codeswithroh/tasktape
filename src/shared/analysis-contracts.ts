export interface ExtractedFrame {
  timestampMs: number
  dataUrl: string
  width: number
  height: number
}

export const MAX_TRANSCRIPTION_AUDIO_BYTES = 25 * 1024 * 1024

export const TRANSCRIBABLE_AUDIO_MIME_TYPES = [
  'audio/flac',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/x-wav'
] as const

export type TranscribableAudioMimeType = (typeof TRANSCRIBABLE_AUDIO_MIME_TYPES)[number]

export interface TranscribeIntentInput {
  data: ArrayBuffer
  mimeType: string
}

export interface TranscribeIntentResult {
  text: string
}

export interface AnalyzeRecordingInput {
  recordingId: string
  durationMs: number
  frames: ExtractedFrame[]
  userIntent: string
}
