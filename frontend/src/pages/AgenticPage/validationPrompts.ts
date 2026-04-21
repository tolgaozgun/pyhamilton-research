import type { AgenticPhase } from '@/types'
import type { LabwareTypeResponse } from '@/lib/api/repositories'

export interface ValidationState {
  procedureDraft?: string
  labwareTypes?: LabwareTypeResponse[]
}

function formatLabwareList(labwareTypes: LabwareTypeResponse[]): string {
  if (!labwareTypes.length) return '(no labware types loaded)'
  return labwareTypes
    .map(lt => `- ${lt.code} (${lt.name}, category: ${lt.category})`)
    .join('\n')
}

export const VALIDATION_PROMPTS: Record<
  AgenticPhase,
  (state: ValidationState) => { prompt: string; description: string }
> = {
  procedure: ({ procedureDraft, labwareTypes = [] }) => ({
    description: 'Validates that the procedure is clearly defined',
    prompt: procedureDraft
      ? `Validate the following procedure draft:

${procedureDraft}

Available labware types in this system for reference:
${formatLabwareList(labwareTypes)}

Check for:
1. Clear, step-by-step instructions
2. Specific volumes and timings mentioned
3. References to labware that exists on the deck
4. Logical flow of operations
5. No ambiguous instructions

Respond with:
VALID
<feedback confirming the procedure is clear>

or:
INVALID
<specific issues found>`
      : 'No procedure defined yet. Please describe the step-by-step protocol.',
  }),

  generation: () => ({
    description: 'Generation step - validation happens after code generation',
    prompt: 'This step is validated after code generation and verification.',
  }),
}

export function getValidationPrompt(
  phase: AgenticPhase,
  state: ValidationState
): { prompt: string; description: string } {
  return VALIDATION_PROMPTS[phase](state)
}
