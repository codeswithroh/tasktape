import { Check, Eye, EyeOff, KeyRound, LoaderCircle, Save, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { ApiKeyStatus } from '../../../shared/contracts'
import { AgentConnectionSettings } from './AgentConnectionSettings'

function statusCopy(status: ApiKeyStatus | null): string {
  if (!status) return 'Checking credential status'
  if (status.source === 'app') return 'App key configured'
  if (status.source === 'environment') return 'Using development environment key'
  return 'No API key configured'
}

export function ApiKeySettings(): React.JSX.Element {
  const [status, setStatus] = useState<ApiKeyStatus | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void window.tasktape.settings
      .getApiKeyStatus()
      .then((next) => {
        if (active) setStatus(next)
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to read settings.')
      })
    return () => {
      active = false
    }
  }, [])

  const saveKey = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      setStatus(await window.tasktape.settings.saveApiKey(apiKey))
      setApiKey('')
      setVisible(false)
      setMessage('The key is encrypted with macOS secure storage.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'TaskTape could not save the key.')
    } finally {
      setBusy(false)
    }
  }

  const clearKey = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      setStatus(await window.tasktape.settings.clearApiKey())
      setMessage('The app-managed key was removed.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'TaskTape could not remove the key.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Connections</h1>
        </div>
        <div className="local-status">
          <span />
          Stored locally
        </div>
      </header>

      <div className="settings-stack">
        <AgentConnectionSettings />
        <section className="settings-panel" aria-labelledby="api-key-title">
          <div className="settings-heading">
            <span className="settings-icon">
              <KeyRound size={20} />
            </span>
            <div>
              <h2 id="api-key-title">API key</h2>
              <p>Used only by TaskTape's main process when analyzing a recording.</p>
            </div>
            <span className={`credential-status source-${status?.source ?? 'loading'}`}>
              {status?.configured ? <Check size={13} /> : <KeyRound size={13} />}
              {statusCopy(status)}
            </span>
          </div>

          <form
            className="key-form"
            onSubmit={(event) => {
              event.preventDefault()
              void saveKey()
            }}
          >
            <label htmlFor="openai-api-key">OpenAI API key</label>
            <div className="secret-input">
              <input
                id="openai-api-key"
                type={visible ? 'text' : 'password'}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="sk-proj-..."
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setVisible((current) => !current)}
                aria-label={visible ? 'Hide API key' : 'Show API key'}
                title={visible ? 'Hide API key' : 'Show API key'}
              >
                {visible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="field-note">
              Saving a new key replaces the app-managed key. The value is never shown again.
            </p>
            {error ? <p className="settings-message error-message">{error}</p> : null}
            {message ? <p className="settings-message">{message}</p> : null}
            <div className="settings-actions">
              <button
                className="record-button save-key-button"
                type="submit"
                disabled={busy || !apiKey}
              >
                {busy ? <LoaderCircle className="spinner" size={16} /> : <Save size={16} />}
                Save key
              </button>
              <button
                className="remove-key-button"
                type="button"
                disabled={busy || status?.source !== 'app'}
                onClick={() => void clearKey()}
              >
                <Trash2 size={16} />
                Remove app key
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  )
}
