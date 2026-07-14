import { CircleDot, History, Settings2, Sparkles, Workflow } from 'lucide-react'

export function App(): React.JSX.Element {
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

        <section className="recorder" aria-labelledby="recorder-title">
          <div className="recorder-visual" aria-hidden="true">
            <div className="capture-frame">
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
          </div>

          <div className="recorder-copy">
            <p className="step-label">New workflow</p>
            <h2 id="recorder-title">Show it once</h2>
            <p>
              Record a workflow, then explain the outcome you want. TaskTape will turn both into an
              editable recipe before anything runs.
            </p>
            <button className="record-button" type="button" disabled>
              <CircleDot size={18} />
              Recorder coming in Milestone 1
            </button>
            <p className="honesty-note">
              The application shell is ready. Recording is not implemented yet.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
