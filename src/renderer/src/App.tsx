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

import { useRecorder } from './recorder/useRecorder'

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
  const recorder = useRecorder()
  const isBusy = recorder.state === 'requesting' || recorder.state === 'saving'

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
          <button className="nav-item active" type="button">
            <Workflow size={17} />
            Workflows
          </button>
          <button className="nav-item" type="button" disabled>
            <History size={17} />
            Run history
          </button>
        </nav>
        <button className="nav-item settings" type="button" disabled>
          <Settings2 size={17} />
          Settings
        </button>
      </aside>

      <main className="workspace">
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

        <section className={`recorder state-${recorder.state}`} aria-labelledby="recorder-title">
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
                  {recorder.state === 'requesting' ? 'Choose what to share' : 'Saving locally'}
                </strong>
                <p>
                  {recorder.state === 'requesting'
                    ? 'Select a screen or window in the macOS picker.'
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
            {recorder.state === 'ready' && recorder.metadata ? (
              <>
                <p className="step-label success-label">
                  <Check size={13} />
                  Recording saved
                </p>
                <h2 id="recorder-title">Ready to explain</h2>
                <p>
                  Your recording is stored locally. The intent interview arrives in Milestone 2.
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
                </dl>
                <button className="record-button" type="button" disabled>
                  <Sparkles size={17} />
                  Continue to intent interview
                </button>
                <div className="secondary-actions">
                  <button
                    type="button"
                    onClick={() => void recorder.discard().then(recorder.start)}
                  >
                    <RotateCcw size={16} />
                    Record again
                  </button>
                  <button
                    className="danger-action"
                    type="button"
                    onClick={() => void recorder.discard()}
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
                <p>TaskTape is capturing the selected screen. Stop when the outcome is complete.</p>
                <button className="record-button stop-button" type="button" onClick={recorder.stop}>
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
        </section>
      </main>
    </div>
  )
}
