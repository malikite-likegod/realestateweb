export type ContactStatus = 'lead' | 'prospect' | 'client' | 'past_client'
export type Tag = { id: string; name: string; color: string }
export type DealStage = string
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'showing' | 'task' | 'deal_change'

export type ContactWithTags = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  phones: Array<{ id: string; label: string; number: string; isPrimary: boolean }>
  company: string | null
  status: ContactStatus
  leadScore: number
  source: string | null
  birthday: Date | null
  tags: Array<{ tag: { id: string; name: string; color: string } }>
  createdAt: Date
}

export type DealWithDetails = {
  id: string
  title: string
  value: number | null
  stage: { id: string; name: string; color: string }
  assignee: { id: string; name: string; avatarUrl: string | null } | null
  participants: Array<{ contact: { firstName: string; lastName: string } }>
  expectedClose: Date | null
  probability: number
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export type PipelineColumn = {
  stage: { id: string; name: string; color: string; order: number }
  deals: DealWithDetails[]
  total: number
}

export type ActivityFeedItem = {
  id: string
  type: ActivityType
  subject: string | null
  body: string | null
  contact: { firstName: string; lastName: string } | null
  user: { name: string } | null
  occurredAt: Date
}
