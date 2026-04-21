import type { AgenticPhase, DeckConfig } from '@/types'
import type { CarrierTypeResponse, LabwareTypeResponse } from '@/lib/api/repositories'

export interface ValidationState {
  deckConfig?: DeckConfig | null
  procedureDraft?: string
  carriers?: CarrierTypeResponse[]
  labwareTypes?: LabwareTypeResponse[]
}

function formatCarrierList(carriers: CarrierTypeResponse[]): string {
  if (!carriers.length) return '(no carriers loaded)'
  return carriers
    .map(c => `- ${c.code} (${c.name}): ${c.num_slots} slots, accepts [${c.accepts.join(', ')}]`)
    .join('\n')
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
  deck_layout: ({ deckConfig, carriers = [], labwareTypes = [] }) => ({
    description: 'Validates that the deck layout is properly configured',
    prompt: deckConfig
      ? `Validate the following Hamilton deck layout configuration:

${JSON.stringify(deckConfig, null, 2)}

The following carrier types are available in this system:
${formatCarrierList(carriers)}

The following labware types are available in this system:
${formatLabwareList(labwareTypes)}

Check for:
1. Carrier placement conflicts (overlapping rail positions)
2. Each carrier only contains labware it accepts (see accepted types above)
3. At least one tip rack is configured
4. All labware codes used in slots match codes in the available labware list above
5. Aspiration settings are reasonable

Respond with:
VALID
<feedback explaining what looks good>

or:
INVALID
<specific issues found>`
      : 'No deck layout configured yet. Please add carriers and labware to the deck.',
  }),

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
