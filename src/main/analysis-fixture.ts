import type { WorkflowAnalysis } from '../shared/analysis-schema.js'

export const TEST_WORKFLOW_ANALYSIS: WorkflowAnalysis = {
  title: 'Organize creator media',
  summary: 'The recording shows videos and images being organized into folders.',
  goalHypothesis: 'Organize new videos and images using the same folder structure after review.',
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
  mediaRecipe: {
    videoFolder: 'Raw Video',
    imageFolder: 'Images',
    operation: 'move',
    unmatchedPolicy: 'leave',
    unmatchedFolder: 'Unsorted'
  },
  scheduleProposal: {
    frequency: 'weekly',
    time: '09:00',
    weekday: 1
  },
  followUpQuestions: [
    {
      id: 'source_folder',
      prompt: 'Which folder should TaskTape check?',
      reason: 'This sets a clear boundary for the workflow.',
      answerType: 'text',
      options: []
    },
    {
      id: 'collision_policy',
      prompt: 'What should happen when a file name already exists?',
      reason: 'This prevents accidental overwrites.',
      answerType: 'single_choice',
      options: ['Skip and report it', 'Create a unique name', 'Ask before each change']
    }
  ],
  risks: ['Moving files requires exact change review and explicit approval.']
}
