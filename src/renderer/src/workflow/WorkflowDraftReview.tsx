import { ArrowLeft, Check, Pencil } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { WorkflowAnalysis } from '../../../shared/analysis-schema'

interface WorkflowDraftReviewProps {
  analysis: WorkflowAnalysis
  answers: Record<string, string>
  onBack: () => void
  onEdit: () => void
}

function cleanText(value: string): string {
  return value.replace(/\s*[—–]\s*/g, ', ')
}

export function WorkflowDraftReview({
  analysis,
  answers,
  onBack,
  onEdit
}: WorkflowDraftReviewProps): React.JSX.Element {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const heading = headingRef.current
    if (!heading) return

    heading.focus({ preventScroll: true })
    heading.parentElement?.scrollIntoView({ block: 'start' })
  }, [])

  return (
    <div className="workflow-draft">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={15} />
        Back to recording
      </button>

      <p className="step-label success-label" role="status">
        <Check size={13} />
        Answers saved
      </p>
      <h2 id="recorder-title" ref={headingRef} tabIndex={-1}>
        Review the workflow
      </h2>
      <p className="intent-intro">Check what TaskTape learned before it creates a dry run.</p>

      <div className="goal-summary">
        <span>Goal</span>
        <p>{cleanText(analysis.goalHypothesis)}</p>
      </div>

      <section className="learned-rules" aria-labelledby="learned-rules-title">
        <h3 id="learned-rules-title">What TaskTape learned</h3>
        <dl>
          {analysis.followUpQuestions.map((question) => (
            <div key={question.id}>
              <dt>{cleanText(question.prompt)}</dt>
              <dd>{cleanText(answers[question.id])}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="draft-status">
        <Check size={15} aria-hidden="true" />
        <div>
          <strong>Ready for a dry run</strong>
          <p>No files have changed. You will review every action before it runs.</p>
        </div>
      </div>

      <button className="edit-answers-button" type="button" onClick={onEdit}>
        <Pencil size={15} />
        Edit answers
      </button>
    </div>
  )
}
