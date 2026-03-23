const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'

export class OllamaUnavailableError extends Error {
  constructor() {
    super('Local AI unavailable. MLS listing descriptions cannot be generated via external AI.')
  }
}

export async function localComplete(prompt: string, model = 'llama3'): Promise<string> {
  let response: Response
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
    })
  } catch {
    throw new OllamaUnavailableError()
  }

  if (!response.ok) {
    throw new OllamaUnavailableError()
  }

  const data = await response.json() as { response?: string }
  return data.response ?? ''
}
