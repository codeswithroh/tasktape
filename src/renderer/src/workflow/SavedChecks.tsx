import { Bot, Play, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import type { SavedWorkflow } from '../../../shared/workflow-schema'

interface SavedChecksProps {
  onRun: (workflowId: string) => Promise<void>
}

export function SavedChecks({ onRun }: SavedChecksProps): React.JSX.Element | null {
  const [checks, setChecks] = useState<SavedWorkflow[]>([])
  const [runningId, setRunningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setChecks(await window.tasktape.workflow.list())
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load saved checks.')
    }
  }, [])

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0)
    const timer = window.setInterval(() => void refresh(), 2_000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
  }, [refresh])

  if (checks.length === 0 && !error) return null

  const run = async (workflowId: string): Promise<void> => {
    setRunningId(workflowId)
    setError(null)
    try {
      await onRun(workflowId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'TaskTape could not run this check.')
    } finally {
      setRunningId(null)
    }
  }

  return (
    <section className="saved-checks" aria-labelledby="saved-checks-title">
      <header>
        <div>
          <p className="eyebrow">Saved</p>
          <h2 id="saved-checks-title">Replay checks</h2>
        </div>
        <button type="button" onClick={() => void refresh()} aria-label="Refresh saved checks">
          <RefreshCw size={16} />
        </button>
      </header>

      <div className="saved-check-list">
        {checks.map((check) => (
          <article key={check.id} className="saved-check-row">
            <span className="saved-check-icon">
              <Bot size={17} />
            </span>
            <div>
              <h3>{check.name}</h3>
              <p>{check.goal}</p>
              {check.capability === 'computer' && check.expectedOutcome ? (
                <span>Expected: {check.expectedOutcome}</span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void run(check.id)}
              disabled={runningId !== null}
              aria-label={`Run ${check.name}`}
              title={`Run ${check.name}`}
            >
              <Play size={16} />
            </button>
          </article>
        ))}
      </div>
      {error ? <p className="saved-check-error">{error}</p> : null}
    </section>
  )
}
