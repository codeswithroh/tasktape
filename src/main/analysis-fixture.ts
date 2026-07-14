import type { WorkflowAnalysis } from '../shared/analysis-schema.js'

export const TEST_WORKFLOW_ANALYSIS: WorkflowAnalysis = {
  title: 'Organize captured workflow files',
  summary:
    'The recording shows a workspace with a task title, a progress area, and a short list of items.',
  goalHypothesis:
    'Turn a repeated file-organizing routine into a reviewable workflow without changing files yet.',
  observedSteps: [
    {
      order: 1,
      action: 'Open the workflow workspace and review the visible items.',
      target: 'TaskTape test workflow',
      evidenceFrameIndexes: [0]
    }
  ],
  variables: [
    {
      name: 'input location',
      currentValue: 'Not visible in the recording',
      source: 'inferred',
      reason: 'A reusable workflow needs a bounded source location.'
    }
  ],
  uncertainties: [
    'The source folder and classification rules are not visible.',
    'The desired behavior for naming collisions is unknown.'
  ],
  followUpQuestions: [
    {
      id: 'source_folder',
      prompt: 'Which folder should this workflow inspect?',
      reason: 'TaskTape needs an explicit permission boundary before it can suggest file actions.',
      answerType: 'text',
      options: []
    },
    {
      id: 'collision_policy',
      prompt: 'What should happen when a destination already contains a file with the same name?',
      reason: 'A collision rule prevents accidental overwrites or data loss.',
      answerType: 'single_choice',
      options: ['Skip and report it', 'Create a unique name', 'Ask before each change']
    }
  ],
  risks: ['Moving or renaming files requires a dry run and explicit approval.']
}
