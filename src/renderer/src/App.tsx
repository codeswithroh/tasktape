import {
  CircleDot,
  CalendarClock,
  History,
  LoaderCircle,
  MonitorUp,
  Plus,
  Settings2,
  Sparkles,
  Square,
  Workflow,
  X
} from 'lucide-react'
import { useState } from 'react'

import { IntentCapture } from './analysis/IntentCapture'
import { useAnalysis } from './analysis/useAnalysis'
import { RunHistory } from './history/RunHistory'
import { ScheduledTasks } from './schedule/ScheduledTasks'
import { useRecorder } from './recorder/useRecorder'
import { SourcePicker } from './recorder/SourcePicker'
import { ApiKeySettings } from './settings/ApiKeySettings'
import { WorkflowDraftReview } from './workflow/WorkflowDraftReview'

function formatDuration(milliseconds: number): string {
  const totalSeconds = milliseconds === 0 ? 0 : Math.ceil(milliseconds / 1_000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function App(): React.JSX.Element {
  const [view, setView] = useState<'workflows' | 'scheduled' | 'history' | 'settings'>('workflows')
  const recorder = useRecorder()
  const analysis = useAnalysis()
  const [userIntent, setUserIntent] = useState('')
  const isBusy =
    recorder.state === 'requesting' ||
    recorder.state === 'saving' ||
    recorder.state === 'extracting'

  const resetAnalysis = (): void => {
    analysis.reset()
  }

  const createNewWorkflow = (): void => {
    resetAnalysis()
    setUserIntent('')
    void recorder.discard()
    setView('workflows')
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
            className={`nav-item ${view === 'scheduled' ? 'active' : ''}`}
            type="button"
            onClick={() => setView('scheduled')}
          >
            <CalendarClock size={17} />
            Scheduled
          </button>
          <button
            className={`nav-item ${view === 'workflows' ? 'active' : ''}`}
            type="button"
            onClick={() => setView('workflows')}
          >
            <Workflow size={17} />
            Checks
          </button>
          <button
            className={`nav-item ${view === 'history' ? 'active' : ''}`}
            type="button"
            onClick={() => setView('history')}
          >
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
            {view === 'history' ? <RunHistory onCreateNew={createNewWorkflow} /> : null}
            {view === 'scheduled' ? (
              <ScheduledTasks
                onCreateNew={createNewWorkflow}
                onRunNow={async (workflowId) => {
                  await window.tasktape.workflow.runTask(workflowId)
                  setView('history')
                }}
              />
            ) : null}
            <div hidden={view !== 'workflows'}>
              <header className="workspace-header">
                <div>
                  <p className="eyebrow">Replay checks</p>
                  <h1>Turn a bug into a living check</h1>
                </div>
                <div className="header-actions">
                  {recorder.state === 'ready' ? (
                    <button type="button" onClick={createNewWorkflow}>
                      <Plus size={15} />
                      New task
                    </button>
                  ) : null}
                  <div className="local-status">
                    <span />
                    Local-first
                  </div>
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
                        <div className="playback-stage">
                          <video
                            className="recording-preview"
                            src={recorder.previewUrl}
                            controls
                            data-testid="recording-preview"
                          />
                          <div className="playback-details">
                            <div>
                              <strong>Bug recording</strong>
                              <span>Captured on this Mac</span>
                            </div>
                            {recorder.metadata ? (
                              <time>{formatDuration(recorder.metadata.durationMs)}</time>
                            ) : null}
                          </div>
                        </div>
                      ) : recorder.state === 'recording' ? (
                        <div className="recording-live" aria-live="polite">
                          <span className="recording-pulse" />
                          <MonitorUp size={34} />
                          <strong>Recording</strong>
                          <time>{formatDuration(recorder.elapsedMs)}</time>
                          <p>Reproduce the bug in the screen or window you selected.</p>
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
                        <WorkflowDraftReview
                          analysis={analysis.result}
                          onBack={resetAnalysis}
                          onCreateNew={createNewWorkflow}
                          onViewHistory={() => setView('history')}
                        />
                      ) : recorder.state === 'ready' && recorder.metadata ? (
                        <>
                          <IntentCapture
                            key={recorder.metadata.id}
                            initialIntent={userIntent}
                            analyzing={analysis.state === 'analyzing'}
                            analysisError={
                              recorder.frameError
                                ? `Video preparation failed: ${recorder.frameError}`
                                : analysis.error
                            }
                            onSubmit={(intent) => {
                              setUserIntent(intent)
                              void analysis.analyze(recorder.metadata!, recorder.frames, intent)
                            }}
                          />
                          <div className="sr-only" aria-hidden="true">
                            <span data-testid="frame-count">{recorder.frames.length}</span>
                            {recorder.frames.map((frame) => (
                              <img
                                key={frame.timestampMs}
                                src={frame.dataUrl}
                                alt=""
                                data-testid="key-frame"
                              />
                            ))}
                          </div>
                        </>
                      ) : recorder.state === 'recording' ? (
                        <>
                          <p className="step-label recording-label">
                            <CircleDot size={13} />
                            Recording
                          </p>
                          <h2 id="recorder-title">Reproduce the bug</h2>
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
                          <p className="step-label">New task</p>
                          <h2 id="recorder-title">
                            {recorder.state === 'error' ? 'Recording not started' : 'Show it once'}
                          </h2>
                          <p>
                            {recorder.error ??
                              'Record a bug, then describe what should have happened. TaskTape turns both into a replayable check.'}
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
            </div>
          </>
        )}
      </main>
    </div>
  )
}
