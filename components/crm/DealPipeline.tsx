'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { DealStageColumn } from './DealStageColumn'
import { NewDealForm } from './NewDealForm'
import { Modal } from '@/components/ui'
import { formatPrice } from '@/lib/utils'
import type { PipelineColumn, DealWithDetails } from '@/types'

interface Stage { id: string; name: string; color: string }

interface DealPipelineProps {
  columns:     PipelineColumn[]
  stages:      Stage[]
  onMoveDeal?: (dealId: string, toStageId: string) => Promise<void>
}

export function DealPipeline({ columns: initialColumns, stages, onMoveDeal }: DealPipelineProps) {
  const [columns,        setColumns]        = useState(initialColumns)
  const [activeId,       setActiveId]       = useState<string | null>(null)
  const [newDealStageId, setNewDealStageId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const findDeal = useCallback((id: string): DealWithDetails | undefined => {
    for (const col of columns) {
      const deal = col.deals.find(d => d.id === id)
      if (deal) return deal
    }
  }, [columns])

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const dealId    = active.id as string
    const toStageId = over.id  as string

    const sourceCol = columns.find(c => c.deals.some(d => d.id === dealId))
    if (!sourceCol || sourceCol.stage.id === toStageId) return

    // Optimistic update
    const movedDeal = sourceCol.deals.find(d => d.id === dealId)!
    setColumns(prev => prev.map(col => {
      if (col.stage.id === sourceCol.stage.id) return { ...col, deals: col.deals.filter(d => d.id !== dealId) }
      if (col.stage.id === toStageId)          return { ...col, deals: [...col.deals, movedDeal] }
      return col
    }))

    try {
      await onMoveDeal?.(dealId, toStageId)
    } catch {
      setColumns(initialColumns) // revert
    }
  }

  function handleDealCreated(deal: unknown, stageId: string) {
    const d = deal as DealWithDetails
    setColumns(prev => prev.map(col =>
      col.stage.id === stageId ? { ...col, deals: [d, ...col.deals] } : col,
    ))
    setNewDealStageId(null)
  }

  const activeDeal = activeId ? findDeal(activeId) : null

  // Board-level totals for the header strip
  const totalValue    = columns.reduce((s, c) => s + c.total, 0)
  const totalDeals    = columns.reduce((s, c) => s + c.deals.length, 0)
  const weightedValue = columns.reduce((s, c) =>
    s + c.deals.reduce((ss, d) => ss + (d.value ?? 0) * (d.probability / 100), 0), 0)

  return (
    <div>
      {/* Board header strip */}
      <div className="flex items-center gap-6 mb-5 px-1 text-sm">
        <span className="text-charcoal-500">{totalDeals} deals</span>
        <span className="text-charcoal-500">Pipeline: <strong className="text-charcoal-900">{formatPrice(totalValue)}</strong></span>
        <span className="text-charcoal-500">Weighted: <strong className="text-charcoal-900">{formatPrice(weightedValue)}</strong></span>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-6">
          {columns.map(col => (
            <DealStageColumn
              key={col.stage.id}
              column={col}
              onAddDeal={stageId => setNewDealStageId(stageId)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDeal && (
            <div className="rounded-xl bg-white border border-charcoal-200 shadow-2xl p-4 w-64 opacity-90">
              <p className="font-semibold text-charcoal-900 text-sm">{activeDeal.title}</p>
              {activeDeal.value && (
                <p className="text-xs text-charcoal-500 mt-1">{formatPrice(activeDeal.value)}</p>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* New Deal modal */}
      <Modal open={!!newDealStageId} title="New Deal" onClose={() => setNewDealStageId(null)}>
        <NewDealForm
          stages={stages}
          defaultStageId={newDealStageId ?? undefined}
          onCreated={deal => newDealStageId && handleDealCreated(deal, newDealStageId)}
          onCancel={() => setNewDealStageId(null)}
        />
      </Modal>
    </div>
  )
}
