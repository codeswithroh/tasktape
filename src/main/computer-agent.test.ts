import { describe, expect, it, vi } from 'vitest'
import type { ComputerAction } from 'openai/resources/responses/responses'

import {
  COMPUTER_AGENT_MODEL,
  COMPUTER_AGENT_INSTRUCTIONS,
  ComputerAgentMaxTurnsError,
  ComputerSafetyReviewRequiredError,
  runComputerAgent,
  type ComputerAgentProvider,
  type ComputerAgentResponse,
  type ComputerHarness
} from './computer-agent.js'

const screenshot = 'data:image/png;base64,c2NyZWVu'

function response(
  id: string,
  output: ComputerAgentResponse['output'],
  outputText?: string
): ComputerAgentResponse {
  return { id, output, output_text: outputText }
}

function mockHarness() {
  const execute = vi.fn<(action: ComputerAction) => Promise<void>>().mockResolvedValue(undefined)
  const captureScreenshot = vi.fn<() => Promise<string>>().mockResolvedValue(screenshot)
  const activateTarget = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  return { execute, captureScreenshot, activateTarget } satisfies ComputerHarness
}

describe('computer agent', () => {
  it('supports a screenshot-first turn and returns the final output', async () => {
    const harness = mockHarness()
    const provider = vi
      .fn<ComputerAgentProvider>()
      .mockResolvedValueOnce(
        response('resp-1', [
          {
            type: 'computer_call',
            call_id: 'call-1',
            actions: [{ type: 'screenshot' }],
            pending_safety_checks: []
          }
        ])
      )
      .mockResolvedValueOnce(response('resp-2', [], 'Task complete.'))

    const result = await runComputerAgent({ task: 'Open the report.', harness, provider })

    expect(harness.activateTarget).toHaveBeenCalledOnce()
    expect(harness.execute).toHaveBeenCalledWith({ type: 'screenshot' })
    expect(harness.captureScreenshot).toHaveBeenCalledTimes(2)
    expect(provider.mock.calls[0][0]).toEqual({
      model: COMPUTER_AGENT_MODEL,
      tools: [{ type: 'computer' }],
      instructions: COMPUTER_AGENT_INSTRUCTIONS,
      input: 'Open the report.'
    })
    expect(provider.mock.calls[1][0]).toEqual({
      model: COMPUTER_AGENT_MODEL,
      tools: [{ type: 'computer' }],
      instructions: COMPUTER_AGENT_INSTRUCTIONS,
      previous_response_id: 'resp-1',
      input: [
        {
          type: 'computer_call_output',
          call_id: 'call-1',
          output: { type: 'computer_screenshot', image_url: screenshot }
        }
      ]
    })
    expect(result).toEqual({
      output: 'Task complete.',
      actionLog: ['Inspect screen'],
      turns: 2,
      responseId: 'resp-2',
      finalScreenshot: screenshot
    })
  })

  it('executes batched actions in order before capturing the updated screen', async () => {
    const harness = mockHarness()
    const actions: ComputerAction[] = [
      { type: 'click', button: 'left', x: 40, y: 50 },
      { type: 'type', text: 'hello' },
      { type: 'keypress', keys: ['CMD', 'RETURN'] }
    ]
    const provider = vi
      .fn<ComputerAgentProvider>()
      .mockResolvedValueOnce(
        response('resp-1', [
          {
            type: 'computer_call',
            call_id: 'call-1',
            actions,
            pending_safety_checks: []
          }
        ])
      )
      .mockResolvedValueOnce(response('resp-2', [], 'Done'))

    const result = await runComputerAgent({ task: 'Fill the form.', harness, provider })

    expect(harness.execute.mock.calls.map(([action]) => action)).toEqual(actions)
    expect(harness.execute.mock.invocationCallOrder[2]).toBeLessThan(
      harness.captureScreenshot.mock.invocationCallOrder[0]
    )
    expect(result.actionLog).toEqual([
      'Click left at 40,50',
      'Type 5 characters',
      'Press CMD+RETURN'
    ])
  })

  it('stops before executing any action when a safety review is pending', async () => {
    const harness = mockHarness()
    const provider = vi.fn<ComputerAgentProvider>().mockResolvedValue(
      response('resp-1', [
        {
          type: 'computer_call',
          call_id: 'call-before-safe',
          actions: [{ type: 'click', button: 'left', x: 1, y: 2 }],
          pending_safety_checks: []
        },
        {
          type: 'computer_call',
          call_id: 'call-safe',
          actions: [{ type: 'click', button: 'left', x: 10, y: 20 }],
          pending_safety_checks: [
            { id: 'check-1', code: 'confirm', message: 'Confirm this action.' }
          ]
        }
      ])
    )

    const error = await runComputerAgent({ task: 'Continue.', harness, provider }).catch(
      (caught: unknown) => caught
    )

    expect(error).toBeInstanceOf(ComputerSafetyReviewRequiredError)
    expect(error).toMatchObject({
      code: 'COMPUTER_SAFETY_REVIEW_REQUIRED',
      callId: 'call-safe',
      checks: [{ id: 'check-1', code: 'confirm', message: 'Confirm this action.' }]
    })
    expect(harness.execute).not.toHaveBeenCalled()
    expect(harness.captureScreenshot).not.toHaveBeenCalled()
  })

  it('throws a specific error after the configured turn limit', async () => {
    const harness = mockHarness()
    let responseNumber = 0
    const provider = vi.fn<ComputerAgentProvider>().mockImplementation(async () => {
      responseNumber += 1
      return response(`resp-${responseNumber}`, [
        {
          type: 'computer_call',
          call_id: `call-${responseNumber}`,
          actions: [{ type: 'wait' }],
          pending_safety_checks: []
        }
      ])
    })

    const error = await runComputerAgent({
      task: 'Keep checking.',
      harness,
      provider,
      maxTurns: 3
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ComputerAgentMaxTurnsError)
    expect(error).toMatchObject({ code: 'COMPUTER_AGENT_MAX_TURNS', maxTurns: 3 })
    expect(provider).toHaveBeenCalledTimes(3)
    expect(harness.execute).toHaveBeenCalledTimes(3)
  })
})
