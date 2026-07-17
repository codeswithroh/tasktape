import {
  AlertCircle,
  CalendarClock,
  Check,
  Clock3,
  FolderOpen,
  Laptop,
  LoaderCircle,
  Play,
  Plus,
  RefreshCw
} from 'lucide-react'
import { useEffect, useState } from 'react'

import type { ScheduledTask, WorkflowRun } from '../../../shared/workflow-schema'

interface ScheduledTasksProps {
  onCreateNew: () => void
  onRunNow: (workflowId: string) => Promise<void>
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatTime(value: string | null): string {
  if (!value) return ''
  const [hours, minutes] = value.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
}

function formatCadence(task: ScheduledTask): string {
  const { frequency, time, weekday } = task.schedule
  const formattedTime = formatTime(time)

  if (frequency === 'hourly') return 'Every hour'
  if (frequency === 'daily') return `Daily at ${formattedTime}`
  if (frequency === 'weekdays') return `Weekdays at ${formattedTime}`
  return `Every ${WEEKDAYS[weekday ?? 0]} at ${formattedTime}`
}

function formatRunDate(value: string): string {
  const date = new Date(value)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const sameDay = (left: Date, right: Date): boolean =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()

  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)

  if (sameDay(date, today)) return `Today, ${time}`
  if (sameDay(date, tomorrow)) return `Tomorrow, ${time}`
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

function statusLabel(status: WorkflowRun['status']): string {
  if (status === 'completed') return 'Completed'
  if (status === 'partial') return 'Partially completed'
  return 'Failed'
}

export function ScheduledTasks({ onCreateNew, onRunNow }: ScheduledTasksProps): React.JSX.Element {
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    setState('loading')
    setActionError(null)
    try {
      setTasks(await window.tasktape.workflow.scheduled())
      setState('ready')
    } catch {
      setState('error')
    }
  }

  useEffect(() => {
    let active = true

    void window.tasktape.workflow
      .scheduled()
      .then((scheduledTasks) => {
        if (!active) return
        setTasks(scheduledTasks)
        setState('ready')
      })
      .catch(() => {
        if (active) setState('error')
      })

    return () => {
      active = false
    }
  }, [])

  const setEnabled = async (task: ScheduledTask, enabled: boolean): Promise<void> => {
    setUpdatingId(task.workflow.id)
    setActionError(null)
    try {
      const schedule = await window.tasktape.workflow.setScheduleEnabled({
        workflowId: task.workflow.id,
        enabled
      })
      setTasks((current) =>
        current.map((item) =>
          item.workflow.id === task.workflow.id ? { ...item, schedule } : item
        )
      )
    } catch {
      setActionError(`Could not ${enabled ? 'resume' : 'pause'} ${task.workflow.name}.`)
    } finally {
      setUpdatingId(null)
    }
  }

  const runNow = async (task: ScheduledTask): Promise<void> => {
    setRunningId(task.workflow.id)
    setActionError(null)
    try {
      await onRunNow(task.workflow.id)
    } catch {
      setActionError(`Could not run ${task.workflow.name}. Check Run history for details.`)
    } finally {
      setRunningId(null)
    }
  }

  return (
    <section className="scheduled-page" aria-labelledby="scheduled-title">
      <header className="scheduled-header">
        <div>
          <p className="eyebrow">Automation</p>
          <h1 id="scheduled-title">Scheduled</h1>
          <p>Review what runs automatically and when.</p>
        </div>
        <div className="scheduled-header-actions">
          <button
            className="icon-button"
            type="button"
            onClick={() => void load()}
            disabled={state === 'loading'}
            title="Refresh scheduled tasks"
          >
            {state === 'loading' ? (
              <LoaderCircle className="spinner" size={17} />
            ) : (
              <RefreshCw size={17} />
            )}
            <span className="sr-only">Refresh scheduled tasks</span>
          </button>
          <button className="scheduled-new-button" type="button" onClick={onCreateNew}>
            <Plus size={16} />
            New task
          </button>
        </div>
      </header>

      {state === 'loading' ? (
        <div className="scheduled-state" role="status" aria-live="polite">
          <LoaderCircle className="spinner" size={22} />
          <h2>Loading scheduled tasks</h2>
          <p>Checking what is set to run.</p>
        </div>
      ) : state === 'error' ? (
        <div className="scheduled-state" role="alert">
          <AlertCircle size={22} />
          <h2>Scheduled tasks could not load</h2>
          <p>Check the app connection and try again.</p>
          <button type="button" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="scheduled-state">
          <CalendarClock size={23} />
          <h2>No scheduled tasks</h2>
          <p>Create a workflow and choose when it should run.</p>
          <button className="primary-action" type="button" onClick={onCreateNew}>
            <Plus size={16} />
            New task
          </button>
        </div>
      ) : (
        <>
          {actionError ? (
            <div className="scheduled-action-error" role="alert">
              <AlertCircle size={15} />
              <span>{actionError} Try again.</span>
            </div>
          ) : null}
          <ul className="scheduled-list" aria-label="Scheduled tasks">
            {tasks.map((task) => {
              const enabled = task.schedule.enabled
              const updating = updatingId === task.workflow.id
              const running = runningId === task.workflow.id
              const lastRun = task.lastRun

              return (
                <li key={task.workflow.id} className={enabled ? '' : 'is-paused'}>
                  <div className="scheduled-task-main">
                    <div className="scheduled-task-heading">
                      <h2>{task.workflow.name}</h2>
                      <span className={`scheduled-availability ${enabled ? 'active' : ''}`}>
                        {enabled ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <p>{task.workflow.goal}</p>
                    <div className="scheduled-task-labels">
                      <span>
                        {task.workflow.capability === 'organize_files' ? (
                          <FolderOpen size={14} />
                        ) : (
                          <Laptop size={14} />
                        )}
                        {task.workflow.capability === 'organize_files' ? 'Local files' : 'Computer'}
                      </span>
                      <span>
                        <Clock3 size={14} />
                        {formatCadence(task)}
                      </span>
                    </div>
                  </div>

                  <dl className="scheduled-run-meta">
                    <div>
                      <dt>Next run</dt>
                      <dd>
                        {enabled ? (
                          <time dateTime={task.schedule.nextRunAt}>
                            {formatRunDate(task.schedule.nextRunAt)}
                          </time>
                        ) : (
                          'Paused'
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Last run</dt>
                      <dd>
                        {lastRun ? (
                          <>
                            <span className={`scheduled-run-status ${lastRun.status}`}>
                              {lastRun.status === 'completed' ? (
                                <Check size={12} />
                              ) : (
                                <AlertCircle size={12} />
                              )}
                              {statusLabel(lastRun.status)}
                            </span>
                            <time dateTime={lastRun.completedAt}>
                              {formatRunDate(lastRun.completedAt)}
                            </time>
                          </>
                        ) : (
                          'Not run yet'
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div className="scheduled-task-actions">
                    <button
                      className="schedule-switch"
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`${enabled ? 'Pause' : 'Resume'} ${task.workflow.name}`}
                      onClick={() => void setEnabled(task, !enabled)}
                      disabled={updating}
                    >
                      <span className="schedule-switch-track" aria-hidden="true">
                        <span />
                      </span>
                      <span>{updating ? 'Updating' : enabled ? 'Pause' : 'Resume'}</span>
                    </button>
                    <button
                      className="scheduled-run-button"
                      type="button"
                      onClick={() => void runNow(task)}
                      disabled={running || updating}
                    >
                      {running ? (
                        <LoaderCircle className="spinner" size={15} />
                      ) : (
                        <Play size={15} fill="currentColor" />
                      )}
                      {running ? 'Running' : 'Run now'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="scheduled-count" role="status">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} scheduled
          </p>
        </>
      )}
    </section>
  )
}
