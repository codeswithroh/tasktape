import { ArrowLeft, Check, CircleHelp, Eye, Lightbulb } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { WorkflowAnalysis } from '../../../shared/analysis-schema'

interface IntentInterviewProps {
  analysis: WorkflowAnalysis
  onBack: () => void
  onConfirm: (answers: Record<string, string>) => void
}

export function IntentInterview({
  analysis,
  onBack,
  onConfirm
}: IntentInterviewProps): React.JSX.Element {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [confirmed, setConfirmed] = useState(false)
  const allAnswered = useMemo(
    () => analysis.followUpQuestions.every((question) => Boolean(answers[question.id]?.trim())),
    [analysis.followUpQuestions, answers]
  )

  const updateAnswer = (id: string, value: string): void => {
    setAnswers((current) => ({ ...current, [id]: value }))
    setConfirmed(false)
  }

  const submit = (): void => {
    if (!allAnswered) return
    onConfirm(answers)
    setConfirmed(true)
  }

  return (
    <div className="intent-interview">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={15} />
        Back to recording
      </button>
      <p className="step-label success-label">
        <Check size={13} />
        Recording understood
      </p>
      <h2 id="recorder-title">Clarify the intent</h2>
      <p>{analysis.summary}</p>

      <div className="intent-evidence">
        <div>
          <Eye size={14} />
          <span>
            <strong>Observed</strong>
            {analysis.observedSteps.length} visible step
            {analysis.observedSteps.length === 1 ? '' : 's'}
          </span>
        </div>
        <div>
          <Lightbulb size={14} />
          <span>
            <strong>Inferred goal</strong>
            {analysis.goalHypothesis}
          </span>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        {analysis.followUpQuestions.map((question, index) => (
          <div className="intent-question" key={question.id}>
            <label htmlFor={question.id}>
              {index + 1}. {question.prompt}
            </label>
            <span className="question-reason">
              <CircleHelp size={12} />
              {question.reason}
            </span>
            {question.answerType === 'single_choice' ? (
              <select
                id={question.id}
                value={answers[question.id] ?? ''}
                onChange={(event) => updateAnswer(question.id, event.target.value)}
              >
                <option value="">Choose an answer</option>
                {question.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : question.answerType === 'boolean' ? (
              <select
                id={question.id}
                value={answers[question.id] ?? ''}
                onChange={(event) => updateAnswer(question.id, event.target.value)}
              >
                <option value="">Choose an answer</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            ) : (
              <input
                id={question.id}
                value={answers[question.id] ?? ''}
                onChange={(event) => updateAnswer(question.id, event.target.value)}
                placeholder="Type your answer"
              />
            )}
          </div>
        ))}
        <button className="record-button" type="submit" disabled={!allAnswered || confirmed}>
          <Check size={16} />
          {confirmed ? 'Intent confirmed' : 'Confirm intent'}
        </button>
      </form>
    </div>
  )
}
