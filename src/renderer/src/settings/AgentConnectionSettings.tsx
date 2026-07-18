import { Check, Clipboard, PlugZap, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import type { AgentServerStatus } from '../../../shared/agent-schema'

export function AgentConnectionSettings(): React.JSX.Element {
  const [status, setStatus] = useState<AgentServerStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setStatus(await window.tasktape.agent.getStatus())
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to read the agent connection.')
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

  const endpoint = status?.endpoint ?? 'Starting local server...'
  const commands = status
    ? [
        {
          id: 'claude',
          name: 'Claude Code',
          command: `claude mcp add --transport http tasktape ${status.endpoint}`
        },
        {
          id: 'codex',
          name: 'Codex',
          command: `codex mcp add tasktape --url ${status.endpoint}`
        }
      ]
    : []

  const copy = async (id: string, value: string): Promise<void> => {
    await navigator.clipboard.writeText(value)
    setCopied(id)
    window.setTimeout(() => setCopied(null), 1_500)
  }

  return (
    <section className="settings-panel" aria-labelledby="agent-connection-title">
      <div className="settings-heading">
        <span className="settings-icon">
          <PlugZap size={20} />
        </span>
        <div>
          <h2 id="agent-connection-title">Agent connection</h2>
          <p>Connect Claude Code or Codex to the local Replay tools.</p>
        </div>
        <span className={`agent-server-status ${status?.running ? 'running' : ''}`}>
          <span />
          {status?.running ? 'Ready' : 'Starting'}
        </span>
      </div>

      <div className="agent-connection-body">
        <div className="agent-endpoint-row">
          <div>
            <span>Local server</span>
            <code>{endpoint}</code>
          </div>
          <button type="button" onClick={() => void refresh()} aria-label="Refresh agent status">
            <RefreshCw size={16} />
          </button>
        </div>

        {status?.activeSession ? (
          <div className="active-agent-session" role="status">
            <span />
            <div>
              <strong>{status.activeSession.name}</strong>
              <p>{status.activeSession.actionCount} recorded actions</p>
            </div>
          </div>
        ) : null}

        <div className="agent-command-list">
          {commands.map((entry) => (
            <div className="agent-command" key={entry.id}>
              <span>{entry.name}</span>
              <code>{entry.command}</code>
              <button
                type="button"
                onClick={() => void copy(entry.id, entry.command)}
                aria-label={`Copy ${entry.name} connection command`}
                title={`Copy ${entry.name} connection command`}
              >
                {copied === entry.id ? <Check size={16} /> : <Clipboard size={16} />}
              </button>
            </div>
          ))}
        </div>

        {error ? <p className="settings-message error-message">{error}</p> : null}
      </div>
    </section>
  )
}
