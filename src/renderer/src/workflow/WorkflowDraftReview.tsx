import {
  AlertCircle,
  ArrowLeft,
  Check,
  FolderOpen,
  LoaderCircle,
  Pencil,
  Play,
  Save
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { WorkflowAnalysis } from '../../../shared/analysis-schema'
import type {
  SavedWorkflow,
  SaveWorkflowInput,
  WorkflowPlan,
  WorkflowRun
} from '../../../shared/workflow-schema'

interface WorkflowDraftReviewProps {
  analysis: WorkflowAnalysis
  answers: Record<string, string>
  onBack: () => void
  onEdit: () => void
}

function cleanText(value: string): string {
  return value.replace(/\s*[—–]\s*/g, ', ')
}

function fileName(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path
}

function initialOperation(answer: string | undefined): 'move' | 'copy' {
  return answer?.toLowerCase().startsWith('move') ? 'move' : 'copy'
}

function initialUnmatchedPolicy(answer: string | undefined): 'leave' | 'move' {
  return answer?.toLowerCase().includes('unsorted') ? 'move' : 'leave'
}

function inferredFolder(
  structure: string | undefined,
  category: 'video' | 'image',
  fallback: string
): string {
  const matcher = category === 'video' ? /video/i : /image|photo|picture/i
  return (
    structure
      ?.split('/')
      .map((part) => part.trim())
      .find((part) => matcher.test(part)) ?? fallback
  )
}

export function WorkflowDraftReview({
  analysis,
  answers,
  onBack,
  onEdit
}: WorkflowDraftReviewProps): React.JSX.Element {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [recipe, setRecipe] = useState<SaveWorkflowInput>({
    name: analysis.title,
    goal: analysis.goalHypothesis,
    sourceDirectory: answers.media_source ?? '',
    videoFolder: inferredFolder(answers.folder_structure, 'video', 'Videos'),
    imageFolder: inferredFolder(answers.folder_structure, 'image', 'Images'),
    operation: initialOperation(answers.file_action),
    unmatchedPolicy: initialUnmatchedPolicy(answers.unmatched_media),
    unmatchedFolder: 'Unsorted'
  })
  const [workflow, setWorkflow] = useState<SavedWorkflow | null>(null)
  const [plan, setPlan] = useState<WorkflowPlan | null>(null)
  const [run, setRun] = useState<WorkflowRun | null>(null)
  const [approved, setApproved] = useState(false)
  const [busy, setBusy] = useState<'saving' | 'running' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const heading = headingRef.current
    if (!heading) return
    heading.focus({ preventScroll: true })
    heading.parentElement?.scrollIntoView({ block: 'start' })
  }, [plan, run])

  const updateRecipe = <Key extends keyof SaveWorkflowInput>(
    key: Key,
    value: SaveWorkflowInput[Key]
  ): void => {
    setRecipe((current) => ({ ...current, [key]: value }))
    setError(null)
  }

  const chooseDirectory = async (): Promise<void> => {
    const directory = await window.tasktape.workflow.chooseDirectory()
    if (directory) updateRecipe('sourceDirectory', directory)
  }

  const saveAndPlan = async (): Promise<void> => {
    setBusy('saving')
    setError(null)
    try {
      const saved = await window.tasktape.workflow.save(recipe)
      const pendingPlan = await window.tasktape.workflow.plan(saved.id)
      setWorkflow(saved)
      setPlan(pendingPlan)
      setApproved(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this workflow.')
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
      setError(reason instanceof Error ? reason.message : 'The workflow could not run.')
    } finally {
      setBusy(null)
    }
  }

  if (run) {
    const completed = run.results.filter((result) => result.status === 'completed').length
    return (
      <div className="workflow-draft run-result">
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeft size={15} />
          Back to recording
        </button>
        <p className={`step-label ${run.status === 'completed' ? 'success-label' : 'error-label'}`}>
          {run.status === 'completed' ? <Check size={13} /> : <AlertCircle size={13} />}
          Run {run.status}
        </p>
        <h2 id="recorder-title" ref={headingRef} tabIndex={-1}>
          {completed} {completed === 1 ? 'file' : 'files'} updated
        </h2>
        <p className="intent-intro">This result was written to the local activity log.</p>
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
          Edit workflow
        </button>
        <p className="step-label success-label" role="status">
          <Check size={13} />
          Workflow saved
        </p>
        <h2 id="recorder-title" ref={headingRef} tabIndex={-1}>
          Review and run
        </h2>
        <p className="intent-intro">
          {plan.actions.length} {plan.actions.length === 1 ? 'file is' : 'files are'} ready to{' '}
          {workflow.operation}.
        </p>

        <div className="goal-summary">
          <span>Goal</span>
          <p>{cleanText(workflow.goal)}</p>
        </div>

        {plan.actions.length > 0 ? (
          <ul className="plan-actions" aria-label="Files ready to change">
            {plan.actions.map((action) => (
              <li key={action.id}>
                <span className={`file-type ${action.category}`}>{action.category}</span>
                <div>
                  <strong>{fileName(action.sourcePath)}</strong>
                  <span>
                    {workflow.operation === 'move' ? 'Move' : 'Copy'} to{' '}
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
            No matching files need to change.
          </div>
        )}

        {plan.skipped.length > 0 ? (
          <details className="skipped-files">
            <summary>{plan.skipped.length} files will stay where they are</summary>
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
            <span>I reviewed these file changes.</span>
          </label>
        ) : null}

        {error ? <p className="workflow-error">{error}</p> : null}
        <button
          className="record-button run-workflow-button"
          type="button"
          disabled={!approved || plan.actions.length === 0 || busy === 'running'}
          onClick={() => void execute()}
        >
          {busy === 'running' ? <LoaderCircle className="spinner" size={17} /> : <Play size={17} />}
          {busy === 'running' ? 'Running workflow' : 'Run workflow'}
        </button>
      </div>
    )
  }

  return (
    <div className="workflow-draft recipe-editor">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={15} />
        Back to recording
      </button>
      <p className="step-label success-label" role="status">
        <Check size={13} />
        Answers saved
      </p>
      <h2 id="recorder-title" ref={headingRef} tabIndex={-1}>
        Set up the workflow
      </h2>
      <p className="intent-intro">Confirm where files should go, then save the workflow.</p>

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
          value={recipe.goal}
          onChange={(event) => updateRecipe('goal', event.target.value)}
          required
          rows={2}
        />

        <label htmlFor="source-directory">Media folder</label>
        <div className="directory-input">
          <input
            id="source-directory"
            value={recipe.sourceDirectory}
            onChange={(event) => updateRecipe('sourceDirectory', event.target.value)}
            placeholder="Choose a folder"
            required
          />
          <button type="button" onClick={() => void chooseDirectory()} title="Choose folder">
            <FolderOpen size={17} />
            <span className="sr-only">Choose folder</span>
          </button>
        </div>

        <div className="destination-fields">
          <div>
            <label htmlFor="video-folder">Videos go to</label>
            <input
              id="video-folder"
              value={recipe.videoFolder}
              onChange={(event) => updateRecipe('videoFolder', event.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="image-folder">Images go to</label>
            <input
              id="image-folder"
              value={recipe.imageFolder}
              onChange={(event) => updateRecipe('imageFolder', event.target.value)}
              required
            />
          </div>
        </div>

        <fieldset className="recipe-choice">
          <legend>File action</legend>
          <div>
            {(['move', 'copy'] as const).map((operation) => (
              <label key={operation}>
                <input
                  type="radio"
                  name="operation"
                  value={operation}
                  checked={recipe.operation === operation}
                  onChange={() => updateRecipe('operation', operation)}
                />
                <span>{operation === 'move' ? 'Move originals' : 'Keep originals'}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label htmlFor="unmatched-policy">Other files</label>
        <select
          id="unmatched-policy"
          value={recipe.unmatchedPolicy}
          onChange={(event) =>
            updateRecipe('unmatchedPolicy', event.target.value as 'leave' | 'move')
          }
        >
          <option value="leave">Leave them where they are</option>
          <option value="move">Move them to Unsorted</option>
        </select>

        {error ? <p className="workflow-error">{error}</p> : null}
        <button className="record-button" type="submit" disabled={busy === 'saving'}>
          {busy === 'saving' ? <LoaderCircle className="spinner" size={17} /> : <Save size={17} />}
          {busy === 'saving' ? 'Saving workflow' : 'Save workflow'}
        </button>
      </form>

      <button className="edit-answers-button" type="button" onClick={onEdit}>
        <Pencil size={15} />
        Edit answers
      </button>
    </div>
  )
}
