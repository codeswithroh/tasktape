import {
  Check,
  CircleDot,
  History,
  LoaderCircle,
  MonitorUp,
  RotateCcw,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  Workflow,
  X
} from 'lucide-react'
import { useState } from 'react'

import { IntentInterview } from './analysis/IntentInterview'
import { useAnalysis } from './analysis/useAnalysis'
import { useRecorder } from './recorder/useRecorder'
import { SourcePicker } from './recorder/SourcePicker'
import { ApiKeySettings } from './settings/ApiKeySettings'

function formatDuration(milliseconds: number): string {
  const totalSeconds = milliseconds === 0 ? 0 : Math.ceil(milliseconds / 1_000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024 * 1_024) return `${Math.max(1, Math.round(bytes / 1_024))} KB`
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`
}

export function App(): React.JSX.Element {
  const [view, setView] = useState<'workflows' | 'settings'>('workflows')
  const recorder = useRecorder()
  const analysis = useAnalysis()
  const [, setConfirmedAnswers] = useState<Record<string, string> | null>(null)
  const isBusy =
    recorder.state === 'requesting' ||
    recorder.state === 'saving' ||
    recorder.state === 'extracting'

  const resetAnalysis = (): void => {
    analysis.reset()
    setConfirmedAnswers(null)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="wordmark">
          <span className="mark" aria-hidden="true">
            <span />
            <span />
          </span>
          <span>TaskTape</span>
        </div>
        <nav aria-label="Main navigation">
          <button
            className={`nav-item ${view === 'workflows' ? 'active' : ''}`}
            type="button"
            onClick={() => setView('workflows')}
          >
            <Workflow size={17} />
            Workflows
          </button>
          <button className="nav-item" type="button" disabled>
            <History size={17} />
            Run history
          </button>
        </nav>
        <button
          className={`nav-item settings ${view === 'settings' ? 'active' : ''}`}
          type="button"
          onClick={() => setView('settings')}
        >
          <Settings2 size={17} />
          Settings
        </button>
      </aside>

      <main className="workspace">
        {view === 'settings' ? (
          <ApiKeySettings />
        ) : (
          <>
            <header className="workspace-header">
              <div>
                <p className="eyebrow">Your workflows</p>
                <h1>Teach TaskTape a routine</h1>
              </div>
              <div className="local-status">
                <span />
                Local-first
              </div>
            </header>

            <section
              className={`recorder state-${recorder.state} ${recorder.state === 'choosing' ? 'source-mode' : ''} ${analysis.state === 'ready' ? 'analysis-mode' : ''}`}
              aria-labelledby="recorder-title"
            >
              {recorder.state === 'choosing' ? (
                <SourcePicker
                  sources={recorder.sources}
                  onChoose={(id) => void recorder.chooseSource(id)}
                  onRefresh={() => void recorder.refreshSources()}
                  onCancel={recorder.cancelSourceSelection}
                />
              ) : (
                <>
                  <div className="recorder-visual">
                    {recorder.state === 'ready' && recorder.previewUrl ? (
                      <video
                        className="recording-preview"
                        src={recorder.previewUrl}
                        controls
                        data-testid="recording-preview"
                      />
                    ) : recorder.state === 'recording' ? (
                      <div className="recording-live" aria-live="polite">
                        <span className="recording-pulse" />
                        <MonitorUp size={34} />
                        <strong>Recording</strong>
                        <time>{formatDuration(recorder.elapsedMs)}</time>
                        <p>Complete the workflow in the screen or window you selected.</p>
                      </div>
                    ) : isBusy ? (
                      <div className="recording-live" aria-live="polite">
                        <LoaderCircle className="spinner" size={34} />
                        <strong>
                          {recorder.state === 'requesting'
                            ? 'Choose what to share'
                            : recorder.state === 'extracting'
                              ? 'Preparing key frames'
                              : 'Saving locally'}
                        </strong>
                        <p>
                          {recorder.state === 'requesting'
                            ? 'Select a screen or window in the macOS picker.'
                            : recorder.state === 'extracting'
                              ? 'TaskTape is sampling a small, bounded set of frames on this Mac.'
                              : 'TaskTape is securing the recording on this Mac.'}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="capture-frame" aria-hidden="true">
                          <div className="capture-toolbar">
                            <span />
                            <span />
                            <span />
                          </div>
                          <div className="capture-content">
                            <div className="file-row wide" />
                            <div className="file-row" />
                            <div className="file-row medium" />
                            <div className="cursor" />
                          </div>
                        </div>
                        <div className="intent-chip">
                          <Sparkles size={15} />
                          Ask what should change next time
                        </div>
                      </>
                    )}
                  </div>

                  <div className="recorder-copy">
                    {analysis.state === 'ready' && analysis.result ? (
                      <IntentInterview
                        analysis={analysis.result}
                        onBack={analysis.reset}
                        onConfirm={setConfirmedAnswers}
                      />
                    ) : recorder.state === 'ready' && recorder.metadata ? (
                      <>
                        <p className="step-label success-label">
                          <Check size={13} />
                          Recording saved
                        </p>
                        <h2 id="recorder-title">Ready to explain</h2>
                        <p>
                          Your recording is stored locally. Continue to clarify the intended
                          outcome.
                        </p>
                        <dl className="recording-facts">
                          <div>
                            <dt>Length</dt>
                            <dd>{formatDuration(recorder.metadata.durationMs)}</dd>
                          </div>
                          <div>
                            <dt>Size</dt>
                            <dd>{formatBytes(recorder.metadata.bytes)}</dd>
                          </div>
                          <div>
                            <dt>Key frames</dt>
                            <dd data-testid="frame-count">
                              {recorder.frameError ? 'Unavailable' : recorder.frames.length}
                            </dd>
                          </div>
                        </dl>
                        {recorder.frames.length > 0 ? (
                          <div className="frame-strip" aria-label="Locally prepared key frames">
                            {recorder.frames.map((frame) => (
                              <img
                                key={frame.timestampMs}
                                src={frame.dataUrl}
                                alt={`Key frame at ${formatDuration(frame.timestampMs)}`}
                                data-testid="key-frame"
                              />
                            ))}
                          </div>
                        ) : null}
                        {recorder.frameError ? (
                          <p className="honesty-note">
                            Frame preparation failed: {recorder.frameError}
                          </p>
                        ) : null}
                        {analysis.error ? <p className="analysis-error">{analysis.error}</p> : null}
                        <button
                          className="record-button"
                          type="button"
                          disabled={recorder.frames.length === 0 || analysis.state === 'analyzing'}
                          onClick={() => void analysis.analyze(recorder.metadata!, recorder.frames)}
                        >
                          {analysis.state === 'analyzing' ? (
                            <LoaderCircle className="spinner" size={17} />
                          ) : (
                            <Sparkles size={17} />
                          )}
                          {analysis.state === 'analyzing'
                            ? 'Analyzing recording'
                            : 'Explain this workflow'}
                        </button>
                        <div className="secondary-actions">
                          <button
                            type="button"
                            onClick={() => {
                              resetAnalysis()
                              void recorder.discard().then(recorder.start)
                            }}
                          >
                            <RotateCcw size={16} />
                            Record again
                          </button>
                          <button
                            className="danger-action"
                            type="button"
                            onClick={() => {
                              resetAnalysis()
                              void recorder.discard()
                            }}
                          >
                            <Trash2 size={16} />
                            Discard
                          </button>
                        </div>
                      </>
                    ) : recorder.state === 'recording' ? (
                      <>
                        <p className="step-label recording-label">
                          <CircleDot size={13} />
                          Recording
                        </p>
                        <h2 id="recorder-title">Perform the workflow</h2>
                        <p>
                          TaskTape is capturing the selected screen. Stop when the outcome is
                          complete.
                        </p>
                        <button
                          className="record-button stop-button"
                          type="button"
                          onClick={recorder.stop}
                        >
                          <Square size={16} fill="currentColor" />
                          Stop and save
                        </button>
                        <button className="cancel-button" type="button" onClick={recorder.cancel}>
                          <X size={16} />
                          Cancel recording
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="step-label">New workflow</p>
                        <h2 id="recorder-title">
                          {recorder.state === 'error' ? 'Recording interrupted' : 'Show it once'}
                        </h2>
                        <p>
                          {recorder.error ??
                            'Record a workflow, then explain the outcome you want. TaskTape turns both into an editable recipe before anything runs.'}
                        </p>
                        <button
                          className="record-button"
                          type="button"
                          onClick={() => void recorder.start()}
                          disabled={isBusy}
                        >
                          {isBusy ? (
                            <LoaderCircle className="spinner" size={18} />
                          ) : (
                            <CircleDot size={18} />
                          )}
                          {recorder.state === 'requesting'
                            ? 'Waiting for selection'
                            : recorder.state === 'saving'
                              ? 'Saving recording'
                              : recorder.state === 'error'
                                ? 'Try again'
                                : 'Start recording'}
                        </button>
                        <p className="honesty-note">
                          {recorder.permissionStatus === 'denied'
                            ? 'Screen access is denied in macOS System Settings.'
                            : 'You choose exactly which screen or window TaskTape can see.'}
                        </p>
                      </>
                    )}
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
