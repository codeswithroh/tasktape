import type { WorkflowAnalysis } from '../shared/analysis-schema.js'

export const TEST_WORKFLOW_ANALYSIS: WorkflowAnalysis = {
  title: 'Organize project assets',
  summary: 'The recording shows new assets being placed into an existing project structure.',
  goalHypothesis: 'Place new assets into the folder structure shown in the recording.',
  observedSteps: [
    {
      order: 1,
      action: 'Review the new assets and the visible destination folders.',
      target: 'Downloads',
      evidenceFrameIndexes: [0]
    }
  ],
  variables: [
    {
      name: 'watched folder',
      currentValue: 'Downloads',
      source: 'observed',
      reason: 'The recording shows the Downloads folder.'
    }
  ],
  uncertainties: ['Files that do not match a demonstrated asset group should remain untouched.'],
  learnedWorkflow: {
    capability: 'organize_files',
    summary: 'Sort new assets into the matching folders shown in the recording.',
    steps: [
      {
        label: 'Notice new assets',
        description: 'Check the selected folder for newly added project files.'
      },
      {
        label: 'Match the demonstrated structure',
        description: 'Identify each asset using the file patterns learned from the recording.'
      },
      {
        label: 'Place each asset',
        description:
          'Move matching assets into their learned project folders and leave others alone.'
      }
    ],
    fileOrganization: {
      sourceHint: 'Downloads',
      operation: 'move',
      rules: [
        {
          id: 'project_footage',
          label: 'Project footage',
          extensions: ['.avi', '.m4v', '.mkv', '.mov', '.mp4', '.webm'],
          destinationFolder: 'Raw Video'
        },
        {
          id: 'visual_assets',
          label: 'Visual assets',
          extensions: ['.gif', '.heic', '.jpeg', '.jpg', '.png', '.raw', '.webp'],
          destinationFolder: 'Images'
        },
        {
          id: 'project_packages',
          label: 'Project packages',
          extensions: ['.zip'],
          destinationFolder: 'Deliverables'
        }
      ],
      unmatchedPolicy: 'leave',
      unmatchedFolder: null
    },
    computerAutomation: null
  },
  scheduleProposal: {
    frequency: 'weekly',
    time: '09:00',
    weekday: 1
  },
  risks: ['Moving files requires exact change review and explicit approval.']
}

export const TEST_COMPUTER_WORKFLOW_ANALYSIS: WorkflowAnalysis = {
  ...TEST_WORKFLOW_ANALYSIS,
  title: 'Publish weekly project update',
  summary: 'The recording shows a project update being reviewed and published in another app.',
  goalHypothesis: 'Review and publish the weekly project update.',
  learnedWorkflow: {
    capability: 'computer',
    summary: 'Review the project update and publish it to the team workspace.',
    steps: [
      {
        label: 'Review the update',
        description: 'Check the drafted project update for accuracy.'
      },
      {
        label: 'Publish to the workspace',
        description: 'Open the team workspace and publish the approved update.'
      }
    ],
    fileOrganization: null,
    computerAutomation: {
      instructions:
        'Open the team workspace, review the drafted weekly project update, and publish it after confirming the content is accurate.',
      targetApp: 'Browser',
      expectedOutcome: 'The approved weekly project update is visibly published in the workspace.'
    }
  },
  scheduleProposal: null,
  risks: ['Publishing content is externally visible and requires explicit approval.']
}
