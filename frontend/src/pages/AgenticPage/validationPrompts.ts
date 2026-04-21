import type { AgenticPhase, DeckConfig } from '@/types'

/**
 * Static validation prompts for each phase.
 * These are system-defined prompts that validate the current state of each step.
 */
export const VALIDATION_PROMPTS: Record<
  AgenticPhase,
  (state: { deckConfig?: DeckConfig | null; procedureDraft?: string }) => {
    prompt: string
    description: string
  }
> = {
  deck_layout: ({ deckConfig }) => ({
    description: 'Validates that the deck layout is properly configured',
    prompt: deckConfig
      ? `Validate the following Hamilton deck layout configuration:

${JSON.stringify(deckConfig, null, 2)}

Check for:
1. Carrier placement conflicts (overlapping rail positions)
2. Proper labware types in appropriate carriers
3. At least one tip rack is configured
4. No empty slots between carriers on the same rail
5. Aspiration settings are reasonable

Respond with a JSON object:
{
  "valid": boolean,
  "feedback": string (explain any issues or confirm everything looks good)
}`
      : 'No deck layout configured yet. Please add carriers and labware to the deck.',
  }),

  procedure: ({ procedureDraft }) => ({
    description: 'Validates that the procedure is clearly defined',
    prompt: procedureDraft
      ? `Validate the following procedure draft:

${procedureDraft}

Check for:
1. Clear, step-by-step instructions
2. Specific volumes and timings mentioned
3. References to labware that exists on the deck
4. Logical flow of operations
5. No ambiguous instructions

Respond with a JSON object:
{
  "valid": boolean,
  "feedback": string (explain any issues or confirm the procedure is clear)
}`
      : 'No procedure defined yet. Please describe the step-by-step protocol.',
  }),

  generation: () => ({
    description: 'Generation step - validation happens after code generation',
    prompt: 'This step is validated after code generation and verification.',
  }),
}

/**
 * Get the validation prompt for a phase with current state
 */
export function getValidationPrompt(
  phase: AgenticPhase,
  state: { deckConfig?: DeckConfig | null; procedureDraft?: string }
): { prompt: string; description: string } {
  return VALIDATION_PROMPTS[phase](state)
}
