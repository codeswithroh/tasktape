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
  const computerAutomation = learned.computerAutomation
  const isComputerTask = learned.capability === 'computer'
  const [goal, setGoal] = useState(analysis.goalHypothesis)
  const [instructions, setInstructions] = useState(
    computerAutomation?.instructions ?? analysis.goalHypothesis
  )
  const [expectedOutcome, setExpectedOutcome] = useState(computerAutomation?.expectedOutcome ?? '')
  const [sourceDirectory, setSourceDirectory] = useState('')
  const [workflow, setWorkflow] = useState<SavedWorkflow | null>(null)
  const [plan, setPlan] = useState<WorkflowPlan | null>(null)
  const [run, setRun] = useState<WorkflowRun | null>(null)
  const [schedule, setSchedule] = useState<WorkflowSchedule | null>(null)
  const [runWhen, setRunWhen] = useState<'manual' | 'hourly' | 'daily' | 'weekdays' | 'weekly'>(
    analysis.scheduleProposal?.frequency ?? 'manual'
  )
  const [scheduleTime, setScheduleTime] = useState(
    analysis.scheduleProposal?.time ?? defaultScheduleTime
  )
  const [weekday, setWeekday] = useState(analysis.scheduleProposal?.weekday ?? new Date().getDay())
  const [approved, setApproved] = useState(false)
  const [allowScheduledRuns, setAllowScheduledRuns] = useState(false)
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
    setError(null)
    if (runWhen !== 'manual' && !allowScheduledRuns) {
      setError('Confirm that TaskTape can run this task on the schedule you chose.')
      return
    }
    let input: SaveWorkflowInput
    if (isComputerTask) {
      if (!computerAutomation) {
        setError('TaskTape needs complete computer instructions before saving.')
        return
      }
      input = {
        name: analysis.title,
        goal,
        instructions,
        approvalMode: runWhen === 'manual' ? 'review_each_run' : 'allow_unattended',
        capability: 'computer',
        targetApp: computerAutomation.targetApp,
        expectedOutcome: expectedOutcome.trim() || null
      }
    } else {
      if (!organization) {
        setError('TaskTape needs complete file instructions before saving.')
        return
      }
      const selectedDirectory = sourceDirectory || (await chooseDirectory())
      if (!selectedDirectory) {
        setError('Choose the folder this task can access before saving.')
        return
      }
      input = {
        name: analysis.title,
        goal,
        instructions,
        approvalMode: runWhen === 'manual' ? 'review_each_run' : 'allow_unattended',
        capability: 'organize_files',
        sourceDirectory: selectedDirectory,
        operation: organization.operation,
        rules: organization.rules,
        unmatchedPolicy: organization.unmatchedPolicy,
        unmatchedFolder: organization.unmatchedFolder
      }
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
            time: runWhen === 'hourly' ? null : scheduleTime,
            weekday: runWhen === 'weekly' ? weekday : null
          })
        )
      }
      setPlan(isComputerTask ? null : await window.tasktape.workflow.plan(saved.id))
      setApproved(false)
    } catch (reason) {
      setError(friendlyError(reason, 'Could not save this task. Check its access and try again.'))
    } finally {
      setBusy(null)
    }
  }

  const execute = async (): Promise<void> => {
    if (!workflow || !approved) return
    if (workflow.capability === 'organize_files' && (!plan || plan.actions.length === 0)) return
    setBusy('running')
    setError(null)
    try {
      setRun(
        workflow.capability === 'computer'
          ? await window.tasktape.workflow.runTask(workflow.id)
          : await window.tasktape.workflow.execute({ workflowId: workflow.id, planId: plan!.id })
      )
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
      setRun(null)
      setPlan(
        workflow.capability === 'organize_files'
          ? await window.tasktape.workflow.plan(workflow.id)
          : null
      )
      setApproved(false)
    } catch (reason) {
      setError(friendlyError(reason, 'Could not check for new work. Please try again.'))
    } finally {
      setBusy(null)
    }
  }

  if (run) {
    const completed = run.results.filter((result) => result.status === 'completed').length
    const verification = run.verification
    const verificationHeading =
      verification?.status === 'passed'
        ? 'Expected result confirmed'
        : verification?.status === 'failed'
          ? 'Regression found'
          : verification?.status === 'inconclusive'
            ? 'Result needs review'
            : `${completed} ${completed === 1 ? 'item' : 'items'} updated`
    const resultSucceeded = verification
      ? verification.status === 'passed'
      : run.status === 'completed'
    return (
      <div className="workflow-draft run-result">
        <p className={`step-label ${resultSucceeded ? 'success-label' : 'error-label'}`}>
          {resultSucceeded ? <Check size={13} /> : <AlertCircle size={13} />}
          {verification
            ? verification.status === 'passed'
              ? 'Check passed'
              : verification.status === 'failed'
                ? 'Check failed'
                : 'Check inconclusive'
            : `Run ${run.status}`}
        </p>
        <h2 id="recorder-title" ref={headingRef} tabIndex={-1}>
          {verificationHeading}
        </h2>
        <p className="intent-intro">
          {verification?.summary ?? 'The run is complete and saved in your history.'}
        </p>
        {verification ? (
          <section className={`verification-result ${verification.status}`}>
            <div>
              <span>Expected result</span>
              <p>{cleanText(verification.expectedOutcome)}</p>
            </div>
            <img src={verification.screenshotDataUrl} alt="Final screen used for this check" />
            {verification.evidence.length > 0 ? (
              <ul aria-label="Visible evidence">
                {verification.evidence.map((item, index) => (
                  <li key={`${item}-${index}`}>{cleanText(item)}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
        <details className="run-activity">
          <summary>{verification ? 'View replay activity' : 'View activity'}</summary>
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
        </details>

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
              New task
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (workflow && (workflow.capability === 'computer' || plan)) {
    const actionCount = plan?.actions.length ?? 0
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
          Task saved
        </p>
        <h2 id="recorder-title" ref={headingRef} tabIndex={-1}>
          Review and run
        </h2>
        <p className="intent-intro">
          {workflow.capability === 'computer'
            ? 'TaskTape will follow these instructions using your Mac.'
            : `${actionCount} ${actionCount === 1 ? 'change is' : 'changes are'} ready.`}
        </p>

        <div className="goal-summary">
          <span>Goal</span>
          <p>{cleanText(workflow.goal)}</p>
        </div>

        {workflow.capability === 'computer' ? (
          <div className="task-instructions-summary">
            <span>Task instructions</span>
            <p>{cleanText(workflow.instructions)}</p>
            {workflow.targetApp ? <small>Starts in {cleanText(workflow.targetApp)}</small> : null}
          </div>
        ) : null}

        {workflow.capability === 'computer' && workflow.expectedOutcome ? (
          <div className="expected-outcome-summary">
            <span>Expected result</span>
            <p>{cleanText(workflow.expectedOutcome)}</p>
          </div>
        ) : null}

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

        {plan && plan.actions.length > 0 ? (
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
        ) : workflow.capability === 'organize_files' ? (
          <div className="empty-plan">
            <Check size={16} />
            Nothing needs to change right now.
          </div>
        ) : null}

        {plan && plan.skipped.length > 0 ? (
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

        {workflow.capability === 'computer' || actionCount > 0 ? (
          <label className="approval-check">
            <input
              type="checkbox"
              checked={approved}
              onChange={(event) => setApproved(event.target.checked)}
            />
            <span>
              {workflow.capability === 'computer'
                ? workflow.expectedOutcome
                  ? 'I reviewed the task and expected result.'
                  : 'I reviewed the task instructions.'
                : 'I reviewed these changes.'}
            </span>
          </label>
        ) : null}

        {error ? (
          <p className="workflow-error" role="alert">
            {error}
          </p>
        ) : null}
        {workflow.capability === 'computer' || actionCount > 0 ? (
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
            {busy === 'running' ? 'Running task' : 'Run task'}
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
          New task
        </button>
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
        Task understood
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

        <label htmlFor="task-instructions">Task instructions</label>
        <textarea
          id="task-instructions"
          value={instructions}
          onChange={(event) => {
            setInstructions(event.target.value)
            setError(null)
          }}
          required
          rows={4}
        />

        {isComputerTask ? (
          <>
            <label htmlFor="expected-outcome">Expected result</label>
            <textarea
              id="expected-outcome"
              value={expectedOutcome}
              onChange={(event) => {
                setExpectedOutcome(event.target.value)
                setError(null)
              }}
              placeholder="What should be visible when this check passes?"
              rows={3}
            />
            <p className="field-note">
              TaskTape checks this against the final screen after replay.
            </p>
          </>
        ) : null}

        {!isComputerTask && organization ? (
          <section className="access-section" aria-labelledby="folder-access-title">
            <div>
              <h3 id="folder-access-title">Folder access</h3>
              <p>
                Choose the folder this task should watch. TaskTape will use the organization it
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
              This task only accesses the folder you choose.
            </p>
          </section>
        ) : (
          <section className="access-section" aria-labelledby="computer-access-title">
            <div>
              <h3 id="computer-access-title">Computer access</h3>
              <p>
                TaskTape will use the screen and accessibility permissions already granted on this
                Mac.
              </p>
            </div>
            {computerAutomation?.targetApp ? (
              <p className="computer-target">Starts in {cleanText(computerAutomation.targetApp)}</p>
            ) : null}
          </section>
        )}

        <section className="schedule-form" aria-labelledby="save-schedule-title">
          <div className="schedule-heading">
            <CalendarClock size={18} />
            <div>
              <h3 id="save-schedule-title">When should it run?</h3>
              <p>Local schedules run while this Mac is awake and TaskTape is open.</p>
            </div>
          </div>
          <fieldset className="schedule-frequency save-frequency">
            <legend className="sr-only">Run frequency</legend>
            <div>
              {(['manual', 'hourly', 'daily', 'weekdays', 'weekly'] as const).map((option) => (
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
                      : option === 'hourly'
                        ? 'Hourly'
                        : option === 'daily'
                          ? 'Every day'
                          : option === 'weekdays'
                            ? 'Weekdays'
                            : 'Every week'}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {runWhen !== 'manual' && runWhen !== 'hourly' ? (
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
          {runWhen !== 'manual' ? (
            <label className="approval-check schedule-approval">
              <input
                type="checkbox"
                checked={allowScheduledRuns}
                onChange={(event) => {
                  setAllowScheduledRuns(event.target.checked)
                  setError(null)
                }}
              />
              <span>Allow TaskTape to run this task automatically at the scheduled time.</span>
            </label>
          ) : null}
        </section>

        {error ? (
          <p className="workflow-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="record-button" type="submit" disabled={busy === 'saving'}>
          {busy === 'saving' ? <LoaderCircle className="spinner" size={17} /> : <Save size={17} />}
          {busy === 'saving' ? 'Saving task' : 'Save task'}
        </button>
      </form>
      <p className="sr-only" aria-live="polite">
        {busy === 'saving' ? 'Saving task' : (error ?? '')}
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
