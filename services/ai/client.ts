import type { AiClientOptions, AiResponse } from './types'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? ''
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY ?? ''

// Simple Anthropic client
export async function callClaude(prompt: string, options: AiClientOptions = {}): Promise<AiResponse> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')

  const model = options.model ?? 'claude-3-5-haiku-20241022'
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? 1024,
      system: options.systemPrompt ?? 'You are a helpful real estate assistant.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`)
  const data = await res.json() as { content: Array<{ text: string }>; usage: { output_tokens: number } }

  return {
    content: data.content[0]?.text ?? '',
    tokensUsed: data.usage.output_tokens,
    model,
  }
}

// Simple OpenAI client (fallback)
export async function callOpenAI(prompt: string, options: AiClientOptions = {}): Promise<AiResponse> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured')

  const model = options.model ?? 'gpt-4o-mini'
  const messages = []
  if (options.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt })
  messages.push({ role: 'user', content: prompt })

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: options.maxTokens ?? 1024 }),
  })

  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`)
  const data = await res.json() as { choices: Array<{ message: { content: string } }>; usage: { completion_tokens: number } }

  return {
    content: data.choices[0]?.message.content ?? '',
    tokensUsed: data.usage.completion_tokens,
    model,
  }
}

// Default — prefer Anthropic, fallback to OpenAI
export async function callAI(prompt: string, options: AiClientOptions = {}): Promise<AiResponse> {
  if (ANTHROPIC_API_KEY) return callClaude(prompt, options)
  if (OPENAI_API_KEY)    return callOpenAI(prompt, options)
  throw new Error('No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.')
}
