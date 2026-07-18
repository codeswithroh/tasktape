import { AlertCircle, Check, History, LoaderCircle, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { WorkflowHistoryEntry } from '../../../shared/workflow-schema'

interface RunHistoryProps {
  onCreateNew: () => void
}

function fileName(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path
}

function formatRunDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

export function RunHistory({ onCreateNew }: RunHistoryProps): React.JSX.Element {
  const [entries, setEntries] = useState<WorkflowHistoryEntry[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  const load = async (): Promise<void> => {
    setState('loading')
    try {
      setEntries(await window.tasktape.workflow.history())
      setState('ready')
    } catch {
      setState('error')
    }
  }

  useEffect(() => {
    void window.tasktape.workflow
      .history()
      .then((history) => {
        setEntries(history)
        setState('ready')
      })
      .catch(() => setState('error'))
  }, [])

  return (
    <section className="history-page" aria-labelledby="history-title">
      <header className="history-header">
        <div>
          <p className="eyebrow">Activity</p>
          <h1 id="history-title">Run history</h1>
          <p>Review replay evidence and earlier task results.</p>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={() => void load()}
          disabled={state === 'loading'}
          title="Refresh history"
        >
          {state === 'loading' ? (
            <LoaderCircle className="spinner" size={17} />
          ) : (
            <RefreshCw size={17} />
          )}
          <span className="sr-only">Refresh history</span>
        </button>
      </header>

      {state === 'error' ? (
        <div className="history-empty" role="alert">
          <AlertCircle size={20} />
          <h2>History could not load</h2>
          <button type="button" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : state === 'ready' && entries.length === 0 ? (
        <div className="history-empty">
          <History size={22} />
          <h2>No runs yet</h2>
          <p>Your completed checks and tasks will appear here.</p>
          <button className="primary-action" type="button" onClick={onCreateNew}>
            Create workflow
          </button>
        </div>
      ) : (
        <ol className="history-list" aria-label="Workflow runs">
          {entries.map((entry) => {
            const verification = entry.run.verification
            const completed = entry.run.results.filter(
              (result) => result.status === 'completed'
            ).length
            const failed = entry.run.results.length - completed
            return (
              <li key={entry.run.id}>
                <details>
                  <summary>
                    <span className={`history-status ${verification?.status ?? entry.run.status}`}>
                      {(verification?.status ?? entry.run.status) === 'passed' ||
                      (!verification && entry.run.status === 'completed') ? (
                        <Check size={15} />
                      ) : (
                        <AlertCircle size={15} />
                      )}
                    </span>
                    <span className="history-run-copy">
                      <strong>{entry.workflowName}</strong>
                      <span>{entry.workflowGoal}</span>
                    </span>
                    <span className="history-run-meta">
                      <time dateTime={entry.run.completedAt}>
                        {formatRunDate(entry.run.completedAt)}
                      </time>
                      <span>{entry.run.trigger === 'schedule' ? 'Scheduled' : 'Manual'}</span>
                      <span>
                        {verification
                          ? verification.status === 'passed'
                            ? 'Passed'
                            : verification.status === 'failed'
                              ? 'Regression found'
                              : 'Needs review'
                          : `${completed} updated${failed > 0 ? `, ${failed} failed` : ''}`}
                      </span>
                    </span>
                  </summary>
                  {verification ? (
                    <div className={`history-verification ${verification.status}`}>
                      <img
                        src={verification.screenshotDataUrl}
                        alt="Final screen used for this check"
                      />
                      <div>
                        <span>Expected result</span>
                        <strong>{verification.expectedOutcome}</strong>
                        <p>{verification.summary}</p>
                      </div>
                    </div>
                  ) : null}
                  <ul className="history-files">
                    {entry.run.results.map((result) => (
                      <li key={result.actionId}>
                        <span>{result.status === 'completed' ? 'Updated' : 'Failed'}</span>
                        <strong>{fileName(result.sourcePath)}</strong>
                        <small>{result.message}</small>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
