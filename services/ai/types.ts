export interface AiClientOptions {
  model?: string
  maxTokens?: number
  systemPrompt?: string
}

export interface AiMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AiResponse {
  content: string
  tokensUsed: number
  model: string
}

export interface CommandResult {
  success: boolean
  data?: unknown
  error?: string
}
