import { ArrowLeft, Check } from 'lucide-react'
import { useState } from 'react'

import type { WorkflowAnalysis } from '../../../shared/analysis-schema'

interface IntentInterviewProps {
  analysis: WorkflowAnalysis
  initialAnswers?: Record<string, string>
  onBack: () => void
  onConfirm: (answers: Record<string, string>) => void
}

export function IntentInterview({
  analysis,
  initialAnswers,
  onBack,
  onConfirm
}: IntentInterviewProps): React.JSX.Element {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers ?? {})

  const cleanText = (value: string): string => value.replace(/\s*[—–]\s*/g, ', ')

  const updateAnswer = (id: string, value: string): void => {
    setAnswers((current) => ({ ...current, [id]: value }))
  }

  const submit = (): void => {
    const complete = analysis.followUpQuestions.every((question) =>
      Boolean(answers[question.id]?.trim())
    )
    if (!complete) return
    onConfirm(answers)
  }

  return (
    <div className="intent-interview">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={15} />
        Back to recording
      </button>
      <p className="step-label success-label">
        <Check size={13} />
        Almost done
      </p>
      <h2 id="recorder-title">A few quick questions</h2>
      <p className="intent-intro">Check the goal, then fill in the missing details.</p>

      <div className="goal-summary">
        <span>Goal</span>
        <p>{cleanText(analysis.goalHypothesis)}</p>
      </div>

      <form
        aria-label="Workflow questions"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <ol className="question-list">
          {analysis.followUpQuestions.map((question, index) => (
            <li className="intent-question" key={question.id}>
              <label htmlFor={question.id}>
                <span aria-hidden="true">{index + 1}</span>
                {cleanText(question.prompt)}
              </label>
              {question.answerType === 'single_choice' ? (
                <select
                  id={question.id}
                  value={answers[question.id] ?? ''}
                  onChange={(event) => updateAnswer(question.id, event.target.value)}
                  aria-describedby={`${question.id}-reason`}
                  required
                >
                  <option value="">Select one</option>
                  {question.options.map((option) => (
                    <option key={option} value={option}>
                      {cleanText(option)}
                    </option>
                  ))}
                </select>
              ) : question.answerType === 'boolean' ? (
                <fieldset
                  className="binary-options"
                  id={question.id}
                  aria-describedby={`${question.id}-reason`}
                >
                  <legend className="sr-only">{cleanText(question.prompt)}</legend>
                  {['Yes', 'No'].map((option) => (
                    <label key={option}>
                      <input
                        type="radio"
                        name={question.id}
                        value={option.toLowerCase()}
                        checked={answers[question.id] === option.toLowerCase()}
                        onChange={(event) => updateAnswer(question.id, event.target.value)}
                        required
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <input
                  id={question.id}
                  value={answers[question.id] ?? ''}
                  onChange={(event) => updateAnswer(question.id, event.target.value)}
                  placeholder="Your answer"
                  aria-describedby={`${question.id}-reason`}
                  autoComplete="off"
                  required
                />
              )}
              <details className="question-reason">
                <summary>Why we ask</summary>
                <p id={`${question.id}-reason`}>{cleanText(question.reason)}</p>
              </details>
            </li>
          ))}
        </ol>
        <button className="record-button" type="submit">
          <Check size={16} />
          Save and review
        </button>
      </form>
    </div>
  )
}
