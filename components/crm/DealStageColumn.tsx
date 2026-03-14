'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import type { PipelineColumn, DealWithDetails } from '@/types'

function DealCard({ deal }: { deal: DealWithDetails }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  const buyer = deal.participants.find(p => p)

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Link href={`/admin/deals/${deal.id}`} className="block rounded-xl bg-white border border-charcoal-100 p-4 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing">
        <p className="font-medium text-charcoal-900 text-sm mb-1">{deal.title}</p>
        {buyer && <p className="text-xs text-charcoal-400">{buyer.contact.firstName} {buyer.contact.lastName}</p>}
        <div className="mt-3 flex items-center justify-between">
          {deal.value && <span className="text-sm font-semibold text-charcoal-700">{formatPrice(deal.value)}</span>}
          <span className="text-xs text-charcoal-300">{deal.probability}%</span>
        </div>
      </Link>
    </div>
  )
}

interface DealStageColumnProps {
  column: PipelineColumn
}

export function DealStageColumn({ column }: DealStageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.stage.id })

  return (
    <div className="flex flex-col gap-3 min-w-[260px] max-w-[260px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: column.stage.color }} />
          <h3 className="text-sm font-semibold text-charcoal-700">{column.stage.name}</h3>
          <span className="text-xs text-charcoal-400 bg-charcoal-100 rounded-full px-1.5 py-0.5">{column.deals.length}</span>
        </div>
        {column.total > 0 && (
          <span className="text-xs font-medium text-charcoal-500">{formatPrice(column.total)}</span>
        )}
      </div>

      {/* Drop zone */}
      <SortableContext items={column.deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex flex-col gap-2.5 min-h-[120px] rounded-xl p-2 transition-colors ${isOver ? 'bg-charcoal-100' : 'bg-charcoal-50'}`}
        >
          {column.deals.map(deal => <DealCard key={deal.id} deal={deal} />)}
        </div>
      </SortableContext>
    </div>
  )
}
