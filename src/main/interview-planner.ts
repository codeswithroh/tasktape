import type { WorkflowAnalysis } from '../shared/analysis-schema.js'

const MEDIA_TERMS = [
  'categorize',
  'classify',
  'folder',
  'image',
  'media',
  'organize',
  'photo',
  'picture',
  'video'
]

const MEDIA_FILE_PATTERN = /\.(?:avi|heic|jpeg|jpg|m4v|mov|mp4|png|raw|webp)\b/i

function analysisText(analysis: WorkflowAnalysis): string {
  return [
    analysis.title,
    analysis.summary,
    analysis.goalHypothesis,
    ...analysis.observedSteps.flatMap((step) => [step.action, step.target]),
    ...analysis.variables.flatMap((variable) => [
      variable.name,
      variable.currentValue,
      variable.reason
    ]),
    ...analysis.uncertainties
  ]
    .join(' ')
    .toLowerCase()
}

export function isMediaOrganizationWorkflow(analysis: WorkflowAnalysis): boolean {
  const text = analysisText(analysis)
  const matchedTerms = MEDIA_TERMS.filter((term) => text.includes(term))
  const namesMediaFiles = MEDIA_FILE_PATTERN.test(text)
  const describesOrganization = matchedTerms.some((term) =>
    ['categorize', 'classify', 'folder', 'organize'].includes(term)
  )
  const describesMedia =
    namesMediaFiles ||
    matchedTerms.some((term) => ['image', 'media', 'photo', 'picture', 'video'].includes(term))

  return describesOrganization && describesMedia
}

export function planIntentInterview(analysis: WorkflowAnalysis): WorkflowAnalysis {
  if (!isMediaOrganizationWorkflow(analysis)) return analysis

  return {
    ...analysis,
    followUpQuestions: [
      {
        id: 'media_source',
        prompt: 'Where should TaskTape look for new videos and images?',
        reason: 'This tells TaskTape where the organizing workflow should begin.',
        answerType: 'text',
        options: []
      },
      {
        id: 'category_rules',
        prompt: 'How do you decide which folder each file belongs in?',
        reason: 'Describe the rule you use, such as project, client, date, or media type.',
        answerType: 'text',
        options: []
      },
      {
        id: 'folder_structure',
        prompt: 'What folder structure should TaskTape create or reuse?',
        reason: 'An example like Project / Raw Video / Images helps make the structure clear.',
        answerType: 'text',
        options: []
      },
      {
        id: 'file_action',
        prompt: 'Should TaskTape move the original files or keep a copy?',
        reason: 'This sets the default action for every matching file.',
        answerType: 'single_choice',
        options: ['Move the originals', 'Copy and keep the originals', 'Ask me each time']
      },
      {
        id: 'unmatched_media',
        prompt: 'What should happen when a file does not match any category?',
        reason: 'This keeps unfamiliar files from being organized incorrectly.',
        answerType: 'single_choice',
        options: ['Leave it where it is', 'Put it in an Unsorted folder', 'Ask me']
      }
    ]
  }
}
