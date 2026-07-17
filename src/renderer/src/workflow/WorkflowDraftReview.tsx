import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  Check,
  FolderOpen,
  History,
  LoaderCircle,
  Play,
  Plus,
  RotateCcw,
  Save
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { WorkflowAnalysis } from '../../../shared/analysis-schema'
import type {
  SavedWorkflow,
  SaveWorkflowInput,
  WorkflowPlan,
  WorkflowRun,
  WorkflowSchedule
} from '../../../shared/workflow-schema'

interface WorkflowDraftReviewProps {
  analysis: WorkflowAnalysis
  onBack: () => void
  onCreateNew: () => void
  onViewHistory: () => void
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function defaultScheduleTime(): string {
  const next = new Date(Date.now() + 60 * 60 * 1_000)
  return `${String(next.getHours()).padStart(2, '0')}:00`
}

function cleanText(value: string): string {
  return value.replace(/\s*[—–]\s*/g, ', ')
}

function friendlyError(reason: unknown, fallback: string): string {
  const message = reason instanceof Error ? reason.message : ''
  if (message.includes('no longer available') || message.includes('ENOENT')) {
    return 'That folder is no longer available. Choose it again.'
  }
  if (message.includes('single folder name')) {
    return 'One of the learned destinations is not valid. Change the description and try again.'
  }
  return fallback
}

function fileName(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path
}

export function WorkflowDraftReview({
  analysis,
  onBack,
  onCreateNew,
  onViewHistory
}: WorkflowDraftReviewProps): React.JSX.Element {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const learned = analysis.learnedWorkflow
  const organization = learned.fileOrganization
  const supported = learned.capability === 'organize_files' && organization !== null
  const [goal, setGoal] = useState(analysis.goalHypothesis)
  const [sourceDirectory, setSourceDirectory] = useState('')
  const [workflow, setWorkflow] = useState<SavedWorkflow | null>(null)
  const [plan, setPlan] = useState<WorkflowPlan | null>(null)
  const [run, setRun] = useState<WorkflowRun | null>(null)
  const [schedule, setSchedule] = useState<WorkflowSchedule | null>(null)
  const [runWhen, setRunWhen] = useState<'manual' | 'daily' | 'weekly'>(
    analysis.scheduleProposal?.frequency ?? 'manual'
  )
  const [scheduleTime, setScheduleTime] = useState(
    analysis.scheduleProposal?.time ?? defaultScheduleTime
  )
  const [weekday, setWeekday] = useState(analysis.scheduleProposal?.weekday ?? new Date().getDay())
  const [approved, setApproved] = useState(false)
  const [busy, setBusy] = useState<'saving' | 'running' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const heading = headingRef.current
    if (!heading) return
    heading.focus({ preventScroll: true })
    heading.parentElement?.scrollIntoView({ block: 'start' })
  }, [plan, run])

  const chooseDirectory = async (): Promise<string | null> => {
    try {
      const directory = await window.tasktape.workflow.chooseDirectory()
      if (directory) {
        setSourceDirectory(directory)
        setError(null)
      }
      return directory
    } catch (reason) {
      setError(friendlyError(reason, 'The folder chooser could not open. Please try again.'))
      return null
    }
  }

  const saveAndPlan = async (): Promise<void> => {
    if (!supported || !organization) return
    setError(null)
    const selectedDirectory = sourceDirectory || (await chooseDirectory())
    if (!selectedDirectory) {
      setError('Choose the folder this workflow can access before saving.')
      return
    }

    const input: SaveWorkflowInput = {
      name: analysis.title,
      goal,
      capability: 'organize_files',
      sourceDirectory: selectedDirectory,
      operation: organization.operation,
      rules: organization.rules,
      unmatchedPolicy: organization.unmatchedPolicy,
      unmatchedFolder: organization.unmatchedFolder
    }

    setBusy('saving')
    try {
      const saved = await window.tasktape.workflow.save(input, workflow?.id)
      setWorkflow(saved)
      if (runWhen !== 'manual') {
        setSchedule(
          await window.tasktape.workflow.saveSchedule({
            workflowId: saved.id,
            frequency: runWhen,
            time: scheduleTime,
            weekday: runWhen === 'weekly' ? weekday : null
          })
        )
      }
      const pendingPlan = await window.tasktape.workflow.plan(saved.id)
      setPlan(pendingPlan)
      setApproved(false)
    } catch (reason) {
      setError(friendlyError(reason, 'Could not save this workflow. Check its folder access.'))
    } finally {
      setBusy(null)
    }
  }

  const execute = async (): Promise<void> => {
    if (!workflow || !plan || !approved || plan.actions.length === 0) return
    setBusy('running')
    setError(null)
    try {
      setRun(await window.tasktape.workflow.execute({ workflowId: workflow.id, planId: plan.id }))
    } catch (reason) {
      setError(
        friendlyError(reason, 'The workflow could not run. No unreported changes were made.')
      )
    } finally {
      setBusy(null)
    }
  }

  const runAgain = async (): Promise<void> => {
    if (!workflow) return
    setBusy('running')
    setError(null)
    try {
      const pendingPlan = await window.tasktape.workflow.plan(workflow.id)
      setRun(null)
      setPlan(pendingPlan)
      setApproved(false)
    } catch (reason) {
      setError(friendlyError(reason, 'Could not check for new work. Please try again.'))
    } finally {
      setBusy(null)
    }
  }

  if (run) {
    const completed = run.results.filter((result) => result.status === 'completed').length
    return (
      <div className="workflow-draft run-result">
        <p className={`step-label ${run.status === 'completed' ? 'success-label' : 'error-label'}`}>
          {run.status === 'completed' ? <Check size={13} /> : <AlertCircle size={13} />}
          Run {run.status}
        </p>
        <h2 id="recorder-title" ref={headingRef} tabIndex={-1}>
          {completed} {completed === 1 ? 'item' : 'items'} updated
        </h2>
        <p className="intent-intro">The run is complete and saved in your history.</p>
        <ul className="run-results" aria-label="Workflow activity">
          {run.results.map((result) => (
            <li key={result.actionId} className={result.status}>
              {result.status === 'completed' ? <Check size={15} /> : <AlertCircle size={15} />}
              <div>
                <strong>{fileName(result.sourcePath)}</strong>
                <span>{result.message}</span>
              </div>
            </li>
          ))}
        </ul>

        <section className="completion-actions" aria-labelledby="next-step-title">
          <div>
            <h3 id="next-step-title">What would you like to do next?</h3>
            <p>Check for new work, review past runs, or teach another workflow.</p>
          </div>
          <div className="completion-action-grid">
            <button
              className="primary-action"
              type="button"
              onClick={() => void runAgain()}
              disabled={busy === 'running'}
            >
              {busy === 'running' ? (
                <LoaderCircle className="spinner" size={16} />
              ) : (
                <RotateCcw size={16} />
              )}
              Run again
            </button>
            <button type="button" onClick={onViewHistory}>
              <History size={16} />
              View run history
            </button>
            <button type="button" onClick={onCreateNew}>
              <Plus size={16} />
              New workflow
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (workflow && plan) {
    return (
      <div className="workflow-draft plan-review">
        <button
          className="back-button"
          type="button"
          onClick={() => {
            setWorkflow(null)
            setPlan(null)
            setApproved(false)
          }}
        >
          <ArrowLeft size={15} />
          Edit setup
        </button>
        <p className="step-label success-label" role="status">
          <Check size={13} />
          Workflow saved
        </p>
        <h2 id="recorder-title" ref={headingRef} tabIndex={-1}>
          Review and run
        </h2>
        <p className="intent-intro">
          {plan.actions.length} {plan.actions.length === 1 ? 'change is' : 'changes are'} ready.
        </p>

        <div className="goal-summary">
          <span>Goal</span>
          <p>{cleanText(workflow.goal)}</p>
        </div>

        {schedule ? (
          <div className="saved-schedule">
            <CalendarClock size={15} />
            <span>
              Next run:{' '}
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short'
              }).format(new Date(schedule.nextRunAt))}
            </span>
          </div>
        ) : null}

        {plan.actions.length > 0 ? (
          <ul className="plan-actions" aria-label="Changes ready for review">
            {plan.actions.map((action) => (
              <li key={action.id}>
                <span className="action-type">{action.category}</span>
                <div>
                  <strong>{fileName(action.sourcePath)}</strong>
                  <span>
                    {action.operation === 'move' ? 'Move' : 'Copy'} to{' '}
                    {fileName(action.destinationPath)} in{' '}
                    {fileName(
                      action.destinationPath.slice(0, action.destinationPath.lastIndexOf('/'))
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-plan">
            <Check size={16} />
            Nothing needs to change right now.
          </div>
        )}

        {plan.skipped.length > 0 ? (
          <details className="skipped-files">
            <summary>{plan.skipped.length} items will stay where they are</summary>
            <ul>
              {plan.skipped.map((item) => (
                <li key={item.path}>
                  <strong>{fileName(item.path)}</strong>
                  <span>{item.reason}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {plan.actions.length > 0 ? (
          <label className="approval-check">
            <input
              type="checkbox"
              checked={approved}
              onChange={(event) => setApproved(event.target.checked)}
            />
            <span>I reviewed these changes.</span>
          </label>
        ) : null}

        {error ? (
          <p className="workflow-error" role="alert">
            {error}
          </p>
        ) : null}
        {plan.actions.length > 0 ? (
          <button
            className="record-button run-workflow-button"
            type="button"
            disabled={!approved || busy === 'running'}
            onClick={() => void execute()}
          >
            {busy === 'running' ? (
              <LoaderCircle className="spinner" size={17} />
            ) : (
              <Play size={17} />
            )}
            {busy === 'running' ? 'Running workflow' : 'Run workflow'}
          </button>
        ) : (
          <button
            className="record-button run-workflow-button"
            type="button"
            disabled={busy === 'running'}
            onClick={() => void runAgain()}
          >
            {busy === 'running' ? (
              <LoaderCircle className="spinner" size={17} />
            ) : (
              <RotateCcw size={17} />
            )}
            Check again
          </button>
        )}
        <button className="new-workflow-button" type="button" onClick={onCreateNew}>
          <Plus size={16} />
          New workflow
        </button>
      </div>
    )
  }

  if (!supported) {
    return (
      <div className="workflow-draft unsupported-workflow">
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeft size={15} />
          Change description
        </button>
        <p className="step-label">What TaskTape learned</p>
        <h2 id="recorder-title" ref={headingRef} tabIndex={-1}>
          {cleanText(learned.summary)}
        </h2>
        <LearnedSteps steps={learned.steps} />
        <div className="capability-notice" role="status">
          <AlertCircle size={18} />
          <div>
            <strong>This workflow cannot run in this build yet</strong>
            <p>TaskTape understood the steps, but the required capability is not available.</p>
          </div>
        </div>
        <div className="unsupported-actions">
          <button className="primary-action" type="button" onClick={onBack}>
            <ArrowLeft size={16} />
            Change description
          </button>
          <button type="button" onClick={onCreateNew}>
            <Plus size={16} />
            New workflow
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="workflow-draft recipe-editor">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={15} />
        Change description
      </button>
      <p className="step-label success-label" role="status">
        <Check size={13} />
        Workflow understood
      </p>
      <h2 id="recorder-title" ref={headingRef} tabIndex={-1}>
        What TaskTape learned
      </h2>
      <p className="intent-intro">{cleanText(learned.summary)}</p>

      <LearnedSteps steps={learned.steps} />
      {organization ? <LearnedRules organization={organization} /> : null}

      <form
        className="recipe-form"
        onSubmit={(event) => {
          event.preventDefault()
          void saveAndPlan()
        }}
      >
        <label htmlFor="workflow-goal">Goal</label>
        <textarea
          id="workflow-goal"
          value={goal}
          onChange={(event) => {
            setGoal(event.target.value)
            setError(null)
          }}
          required
          rows={2}
        />

        <section className="access-section" aria-labelledby="folder-access-title">
          <div>
            <h3 id="folder-access-title">Folder access</h3>
            <p>
              Choose the folder this workflow should watch. TaskTape will use the organization it
              learned automatically.
            </p>
          </div>
          <div className="directory-input">
            <input
              id="source-directory"
              aria-label="Folder this workflow can access"
              value={sourceDirectory}
              placeholder={organization.sourceHint ?? 'Choose a folder'}
              readOnly
              onClick={() => void chooseDirectory()}
              aria-describedby="source-directory-note"
            />
            <button type="button" onClick={() => void chooseDirectory()} title="Choose folder">
              <FolderOpen size={17} />
              <span className="sr-only">Choose folder</span>
            </button>
          </div>
          <p className="field-note" id="source-directory-note">
            TaskTape only accesses the folder you choose.
          </p>
        </section>

        <section className="schedule-form" aria-labelledby="save-schedule-title">
          <div className="schedule-heading">
            <CalendarClock size={18} />
            <div>
              <h3 id="save-schedule-title">When should it run?</h3>
              <p>Scheduled runs happen while TaskTape is open.</p>
            </div>
          </div>
          <fieldset className="schedule-frequency save-frequency">
            <legend className="sr-only">Run frequency</legend>
            <div>
              {(['manual', 'daily', 'weekly'] as const).map((option) => (
                <label key={option}>
                  <input
                    type="radio"
                    name="run-when"
                    value={option}
                    checked={runWhen === option}
                    onChange={() => setRunWhen(option)}
                  />
                  <span>
                    {option === 'manual'
                      ? 'On demand'
                      : option === 'daily'
                        ? 'Every day'
                        : 'Every week'}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {runWhen !== 'manual' ? (
            <div className={`schedule-fields ${runWhen === 'daily' ? 'daily' : ''}`}>
              {runWhen === 'weekly' ? (
                <div>
                  <label htmlFor="schedule-weekday">Day</label>
                  <select
                    id="schedule-weekday"
                    value={weekday}
                    onChange={(event) => setWeekday(Number(event.target.value))}
                  >
                    {WEEKDAYS.map((day, index) => (
                      <option key={day} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div>
                <label htmlFor="schedule-time">Time</label>
                <input
                  id="schedule-time"
                  type="time"
                  value={scheduleTime}
                  onChange={(event) => setScheduleTime(event.target.value)}
                  required
                />
              </div>
            </div>
          ) : null}
        </section>

        {error ? (
          <p className="workflow-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="record-button" type="submit" disabled={busy === 'saving'}>
          {busy === 'saving' ? <LoaderCircle className="spinner" size={17} /> : <Save size={17} />}
          {busy === 'saving' ? 'Saving workflow' : 'Save workflow'}
        </button>
      </form>
      <p className="sr-only" aria-live="polite">
        {busy === 'saving' ? 'Saving workflow' : (error ?? '')}
      </p>
    </div>
  )
}

function LearnedRules({
  organization
}: {
  organization: NonNullable<WorkflowAnalysis['learnedWorkflow']['fileOrganization']>
}): React.JSX.Element {
  return (
    <section className="learned-rules" aria-labelledby="learned-rules-title">
      <h3 id="learned-rules-title">Learned details</h3>
      <ul>
        {organization.rules.map((rule) => (
          <li key={rule.id}>
            <strong>{cleanText(rule.label)}</strong>
            <span>{cleanText(rule.destinationFolder)}</span>
          </li>
        ))}
      </ul>
      <p>
        {organization.unmatchedPolicy === 'leave'
          ? 'Anything that does not match stays where it is.'
          : `Anything else goes to ${organization.unmatchedFolder}.`}
      </p>
    </section>
  )
}

function LearnedSteps({
  steps
}: {
  steps: WorkflowAnalysis['learnedWorkflow']['steps']
}): React.JSX.Element {
  return (
    <section className="learned-actions" aria-labelledby="learned-actions-title">
      <h3 id="learned-actions-title">Actions</h3>
      <ol>
        {steps.map((step, index) => (
          <li key={`${step.label}-${index}`}>
            <span aria-hidden="true">{index + 1}</span>
            <div>
              <strong>{cleanText(step.label)}</strong>
              <p>{cleanText(step.description)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
