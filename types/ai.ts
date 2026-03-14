export type AiJobType =
  | 'lead_scoring'
  | 'blog_generation'
  | 'listing_description'
  | 'market_analysis'
  | 'buyer_intent'

export type AiJobStatus = 'pending' | 'running' | 'completed' | 'failed'

export type AiCommand =
  | 'create_task'
  | 'log_activity'
  | 'update_lead_score'
  | 'create_contact'
  | 'create_note'
  | 'generate_listing_description'

export type AiCommandPayload = {
  command: AiCommand
  data: Record<string, unknown>
}

export type AiWebhookEvent =
  | 'new_lead'
  | 'deal_stage_changed'
  | 'showing_scheduled'
  | 'new_listing'

export type AiWebhookPayload = {
  event: AiWebhookEvent
  timestamp: string
  data: Record<string, unknown>
}
