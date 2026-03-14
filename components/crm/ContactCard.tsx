'use client'

import Link from 'next/link'
import { Phone, Mail, Tag, TrendingUp } from 'lucide-react'
import { Avatar, Badge } from '@/components/ui'
import { Card } from '@/components/layout'
import type { ContactWithTags } from '@/types'

const statusVariants: Record<string, 'default' | 'info' | 'success' | 'gold' | 'warning'> = {
  lead: 'info',
  prospect: 'warning',
  client: 'success',
  past_client: 'default',
}

interface ContactCardProps {
  contact: ContactWithTags
}

export function ContactCard({ contact }: ContactCardProps) {
  const fullName = `${contact.firstName} ${contact.lastName}`
  return (
    <Card hover>
      <Link href={`/admin/contacts/${contact.id}`} className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <Avatar name={fullName} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-charcoal-900 truncate">{fullName}</p>
            {contact.company && <p className="text-xs text-charcoal-400 truncate">{contact.company}</p>}
          </div>
          <Badge variant={statusVariants[contact.status] ?? 'default'} className="capitalize shrink-0">
            {contact.status.replace('_', ' ')}
          </Badge>
        </div>

        <div className="flex flex-col gap-1.5">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-xs text-charcoal-500 hover:text-charcoal-700" onClick={e => e.stopPropagation()}>
              <Mail size={12} /> {contact.email}
            </a>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-xs text-charcoal-500 hover:text-charcoal-700" onClick={e => e.stopPropagation()}>
              <Phone size={12} /> {contact.phone}
            </a>
          )}
        </div>

        {contact.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag size={11} className="text-charcoal-300" />
            {contact.tags.slice(0, 3).map(({ tag }) => (
              <span key={tag.id} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: tag.color + '20', color: tag.color }}>
                {tag.name}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-xs text-charcoal-400 border-t border-charcoal-100 pt-3">
          <TrendingUp size={12} />
          <span>Lead Score: <strong className="text-charcoal-700">{contact.leadScore}</strong></span>
        </div>
      </Link>
    </Card>
  )
}
