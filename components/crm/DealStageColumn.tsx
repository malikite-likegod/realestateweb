'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { Plus, Calendar, User } from 'lucide-react'
import { formatPrice, formatDate } from '@/lib/utils'
import type { PipelineColumn, DealWithDetails } from '@/types'

// ─── Deal card ────────────────────────────────────────────────────────────────

function DealCard({ deal }: { deal: DealWithDetails }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deal.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }

  const primaryContact = deal.participants[0]?.contact
  const daysInPipeline = Math.floor(
    (Date.now() - new Date(deal.createdAt).getTime()) / 86_400_000,
  )
  const isOverdue = deal.expectedClose && new Date(deal.expectedClose) < new Date()

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Link
        href={`/admin/deals/${deal.id}`}
        className="block rounded-xl bg-white border border-charcoal-100 p-3.5 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing group"
        onClick={e => {
          // Allow drag without navigating
          if (isDragging) e.preventDefault()
        }}
      >
        {/* Title */}
        <p className="font-semibold text-charcoal-900 text-sm mb-1 leading-snug group-hover:text-gold-700 transition-colors">
          {deal.title}
        </p>

        {/* Primary contact */}
        {primaryContact && (
          <p className="text-xs text-charcoal-400 mb-2.5 flex items-center gap-1">
            <User size={10} />
            {primaryContact.firstName} {primaryContact.lastName}
          </p>
        )}

        {/* Value + probability */}
        <div className="flex items-center justify-between mb-2">
          {deal.value ? (
            <span className="text-sm font-bold text-charcoal-800">{formatPrice(deal.value)}</span>
          ) : (
            <span className="text-xs text-charcoal-300 italic">No value</span>
          )}
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
            deal.probability >= 70 ? 'bg-green-100 text-green-700' :
            deal.probability >= 40 ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-600'
          }`}>{deal.probability}%</span>
        </div>

        {/* Footer: assignee + close date + age */}
        <div className="flex items-center justify-between text-xs text-charcoal-300 border-t border-charcoal-50 pt-2">
          <span>
            {deal.assignee ? deal.assignee.name : 'Unassigned'}
          </span>
          <div className="flex items-center gap-2">
            {deal.expectedClose && (
              <span className={`flex items-center gap-0.5 ${isOverdue ? 'text-red-500' : ''}`}>
                <Calendar size={9} />
                {formatDate(deal.expectedClose, { month: 'short', day: 'numeric' })}
              </span>
            )}
            <span className="text-charcoal-200">{daysInPipeline}d</span>
          </div>
        </div>
      </Link>
    </div>
  )
}

// ─── Stage column ─────────────────────────────────────────────────────────────

interface DealStageColumnProps {
  column:     PipelineColumn
  onAddDeal?: (stageId: string) => void
}

export function DealStageColumn({ column, onAddDeal }: DealStageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.stage.id })

  return (
    <div className="flex flex-col gap-2.5 min-w-[272px] max-w-[272px]">
      {/* Column header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: column.stage.color }} />
          <h3 className="text-sm font-semibold text-charcoal-700">{column.stage.name}</h3>
          <span className="text-xs text-charcoal-400 bg-charcoal-100 rounded-full px-1.5 py-0.5 font-medium">
            {column.deals.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {column.total > 0 && (
            <span className="text-xs font-semibold text-charcoal-500">{formatPrice(column.total)}</span>
          )}
          {onAddDeal && (
            <button
              onClick={() => onAddDeal(column.stage.id)}
              className="text-charcoal-300 hover:text-charcoal-700 transition-colors"
              title="Add deal to this stage"
            >
              <Plus size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <SortableContext items={column.deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex flex-col gap-2.5 min-h-[140px] rounded-xl p-2 transition-colors ${
            isOver ? 'bg-gold-50 ring-1 ring-gold-300' : 'bg-charcoal-50'
          }`}
        >
          {column.deals.map(deal => <DealCard key={deal.id} deal={deal} />)}

          {column.deals.length === 0 && (
            <div className="flex items-center justify-center h-20 text-xs text-charcoal-300">
              Drop deals here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}
