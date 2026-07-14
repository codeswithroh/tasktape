import { AppWindow, LoaderCircle, Monitor, RefreshCw, X } from 'lucide-react'

import type { CaptureSource } from '../../../shared/contracts'

interface SourcePickerProps {
  sources: CaptureSource[]
  onChoose: (id: string) => void
  onRefresh: () => void
  onCancel: () => void
}

function SourceGroup({
  icon,
  title,
  description,
  sources,
  onChoose
}: {
  icon: React.ReactNode
  title: string
  description: string
  sources: CaptureSource[]
  onChoose: (id: string) => void
}): React.JSX.Element | null {
  if (sources.length === 0) return null

  return (
    <section className="source-group" aria-labelledby={`source-${sources[0].kind}`}>
      <div className="source-group-heading">
        <span>{icon}</span>
        <div>
          <h3 id={`source-${sources[0].kind}`}>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      <div className="source-grid">
        {sources.map((source) => (
          <button
            className="source-tile"
            type="button"
            key={source.id}
            onClick={() => onChoose(source.id)}
            aria-label={`Share ${source.kind === 'screen' ? 'entire screen' : 'window'}: ${source.name}`}
          >
            <span className="source-thumbnail">
              <img src={source.thumbnailUrl} alt="" />
              {source.appIconUrl ? (
                <img className="source-app-icon" src={source.appIconUrl} alt="" />
              ) : null}
              <span className="source-type">
                {source.kind === 'screen' ? <Monitor size={12} /> : <AppWindow size={12} />}
                {source.kind === 'screen' ? 'Entire screen' : 'Window'}
              </span>
            </span>
            <span className="source-name" title={source.name}>
              {source.name}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

export function SourcePicker({
  sources,
  onChoose,
  onRefresh,
  onCancel
}: SourcePickerProps): React.JSX.Element {
  const screens = sources.filter((source) => source.kind === 'screen')
  const windows = sources.filter((source) => source.kind === 'window')

  return (
    <div className="source-picker">
      <header className="source-picker-header">
        <div>
          <p className="step-label">Recording source</p>
          <h2 id="recorder-title">Choose what to record</h2>
          <p>
            Select an entire display or one application window. TaskTape captures only your choice.
          </p>
        </div>
        <div className="source-picker-actions">
          <button
            className="icon-button"
            type="button"
            onClick={onRefresh}
            aria-label="Refresh open windows"
            title="Refresh open windows"
          >
            <RefreshCw size={16} />
          </button>
          <button className="cancel-source-button" type="button" onClick={onCancel}>
            <X size={15} />
            Cancel
          </button>
        </div>
      </header>

      {sources.length === 0 ? (
        <div className="source-loading" aria-live="polite">
          <LoaderCircle className="spinner" size={24} />
          Looking for open screens and windows
        </div>
      ) : (
        <div className="source-list">
          <SourceGroup
            icon={<Monitor size={17} />}
            title="Entire screen"
            description="Everything visible on a display"
            sources={screens}
            onChoose={onChoose}
          />
          <SourceGroup
            icon={<AppWindow size={17} />}
            title="Application windows"
            description={`${windows.length} open window${windows.length === 1 ? '' : 's'}`}
            sources={windows}
            onChoose={onChoose}
          />
        </div>
      )}
    </div>
  )
}
