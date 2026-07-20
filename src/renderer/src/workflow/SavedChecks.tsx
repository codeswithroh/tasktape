import {
  Bot,
  Check,
  ChevronDown,
  Clipboard,
  FileCode2,
  FolderOpen,
  Play,
  RefreshCw
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import type { AgentEvidenceSummary } from '../../../shared/agent-schema'
import type { SavedWorkflow } from '../../../shared/workflow-schema'

interface SavedChecksProps {
  onRun: (workflowId: string) => Promise<void>
}

export function SavedChecks({ onRun }: SavedChecksProps): React.JSX.Element | null {
  const [checks, setChecks] = useState<SavedWorkflow[]>([])
  const [runningId, setRunningId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [evidence, setEvidence] = useState<AgentEvidenceSummary | null>(null)
  const [evidenceBusy, setEvidenceBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
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

  const toggleEvidence = async (workflowId: string): Promise<void> => {
    if (expandedId === workflowId) {
      setExpandedId(null)
      setEvidence(null)
      return
    }

    setExpandedId(workflowId)
    setEvidence(null)
    setEvidenceBusy(true)
    setFeedback(null)
    setError(null)
    try {
      const result = await window.tasktape.agent.getEvidence(workflowId)
      setEvidence(result)
      if (!result) setFeedback('No agent evidence is attached to this check.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load the evidence.')
    } finally {
      setEvidenceBusy(false)
    }
  }

  const copyReport = async (): Promise<void> => {
    if (!evidence) return
    setError(null)
    try {
      await window.tasktape.agent.copyReport(evidence.workflowId)
      setFeedback('Bug report copied')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to copy the bug report.')
    }
  }

  const exportPlaywright = async (workflowId: string): Promise<void> => {
    setFeedback(null)
    setError(null)
    try {
      const result = await window.tasktape.agent.exportPlaywright(workflowId)
      setFeedback(result ? `${result.fileName} saved` : 'Export cancelled')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to export this check.')
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
          <article key={check.id} className="saved-check-item">
            <div className="saved-check-row">
              <span className="saved-check-icon">
                <Bot size={17} />
              </span>
              <div className="saved-check-copy">
                <h3>{check.name}</h3>
                <p>{check.goal}</p>
                {check.capability === 'computer' && check.expectedOutcome ? (
                  <span>Expected: {check.expectedOutcome}</span>
                ) : null}
              </div>
              <div className="saved-check-actions">
                {check.capability === 'computer' ? (
                  <button
                    type="button"
                    onClick={() => void toggleEvidence(check.id)}
                    aria-expanded={expandedId === check.id}
                    aria-label={`Review evidence for ${check.name}`}
                    title="Review evidence"
                  >
                    <ChevronDown size={16} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void run(check.id)}
                  disabled={runningId !== null}
                  aria-label={`Run ${check.name}`}
                  title={`Run ${check.name}`}
                >
                  <Play size={16} />
                </button>
              </div>
            </div>

            {expandedId === check.id ? (
              <div className="check-evidence" aria-live="polite">
                {evidenceBusy ? <p>Loading evidence...</p> : null}
                {evidence ? (
                  <>
                    <div className="evidence-summary">
                      <span>
                        <strong>{evidence.actionCount}</strong> actions
                      </span>
                      <span>
                        <strong>{evidence.screenshotCount}</strong> screenshots
                      </span>
                      <span>
                        <strong>{evidence.consoleCount}</strong> console events
                      </span>
                      <span>
                        <strong>{evidence.networkCount}</strong> network events
                      </span>
                      <span>
                        <strong>{evidence.hasTrace ? 'Ready' : 'Missing'}</strong> trace
                      </span>
                    </div>
                    <div className="evidence-actions">
                      <button type="button" onClick={() => void copyReport()}>
                        {feedback === 'Bug report copied' ? (
                          <Check size={15} />
                        ) : (
                          <Clipboard size={15} />
                        )}
                        Copy bug report
                      </button>
                      <button
                        type="button"
                        onClick={() => void exportPlaywright(check.id)}
                        disabled={!evidence.canExportPlaywright}
                        title={
                          evidence.canExportPlaywright
                            ? 'Save a Playwright TypeScript check'
                            : 'Record this check again to capture portable actions'
                        }
                      >
                        <FileCode2 size={15} />
                        Export Playwright
                      </button>
                      <button
                        type="button"
                        onClick={() => void window.tasktape.agent.revealEvidence(check.id)}
                      >
                        <FolderOpen size={15} />
                        Show files
                      </button>
                    </div>
                    {feedback ? <p className="evidence-feedback">{feedback}</p> : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>
      {error ? <p className="saved-check-error">{error}</p> : null}
    </section>
  )
}
