import { LoaderCircle, Mic, Square, X } from 'lucide-react'

import { useVoiceIntent } from './useVoiceIntent'

interface IntentCaptureProps {
  initialIntent: string
  analyzing: boolean
  analysisError: string | null
  onSubmit: (intent: string) => void
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000))
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`
}

export function IntentCapture({
  initialIntent,
  analyzing,
  analysisError,
  onSubmit
}: IntentCaptureProps): React.JSX.Element {
  const voice = useVoiceIntent(initialIntent)
  const isListening = voice.state === 'listening'
  const isTranscribing = voice.state === 'transcribing'

  return (
    <div className="intent-capture" aria-busy={analyzing || isTranscribing}>
      <p className="step-label">Step 2 of 3</p>
      <h2 id="recorder-title">Describe the expected result</h2>
      <p className="intent-intro">
        Say what should have happened after the steps you recorded. Include any detail the screen
        does not make clear.
      </p>

      <label htmlFor="workflow-intent">Your description</label>
      <div className={`voice-input ${isListening ? 'is-listening' : ''}`}>
        <textarea
          id="workflow-intent"
          value={voice.transcript}
          onChange={(event) => voice.setTranscript(event.target.value)}
          placeholder="For example: After Save, the asset should still show the Video category. Run this check every day at 9 AM."
          rows={6}
          disabled={isListening || isTranscribing}
        />
        <button
          className="voice-button"
          type="button"
          onClick={() => void (isListening ? voice.stop() : voice.start())}
          disabled={voice.state === 'requesting' || isTranscribing || analyzing}
          title={isListening ? 'Stop voice note' : 'Record voice note'}
          aria-label={isListening ? 'Stop voice note' : 'Record voice note'}
        >
          {voice.state === 'requesting' || isTranscribing ? (
            <LoaderCircle className="spinner" size={18} />
          ) : isListening ? (
            <Square size={16} fill="currentColor" />
          ) : (
            <Mic size={18} />
          )}
        </button>
      </div>

      {isListening ? (
        <div className="voice-status" role="status">
          <span />
          <strong>Listening</strong>
          <time>{formatDuration(voice.elapsedMs)}</time>
          <button type="button" onClick={voice.cancel} title="Cancel voice note">
            <X size={15} />
            <span className="sr-only">Cancel voice note</span>
          </button>
        </div>
      ) : isTranscribing ? (
        <p className="voice-message" role="status">
          Turning your voice note into text...
        </p>
      ) : voice.error ? (
        <div className="voice-error" role="alert">
          <p>{voice.error}</p>
          {voice.error.includes('System Settings') ? (
            <button
              type="button"
              onClick={() => void window.tasktape.recorder.openMicrophoneSettings()}
            >
              Open System Settings
            </button>
          ) : null}
        </div>
      ) : voice.state === 'ready' ? (
        <p className="voice-message" role="status">
          Voice note added. Edit anything before continuing.
        </p>
      ) : null}

      {analysisError ? (
        <p className="workflow-error" role="alert">
          {analysisError}
        </p>
      ) : null}

      <p className="intent-privacy">
        Your voice note is sent for transcription. Its text and selected recording frames help
        TaskTape build and verify the replay check.
      </p>

      <button
        className="record-button"
        type="button"
        disabled={!voice.transcript.trim() || isListening || isTranscribing || analyzing}
        onClick={() => onSubmit(voice.transcript.trim())}
      >
        {analyzing ? <LoaderCircle className="spinner" size={17} /> : null}
        {analyzing ? 'Building replay check' : 'Build replay check'}
      </button>
    </div>
  )
}
