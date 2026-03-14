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
import type { PipelineColumn, DealWithDetails } from '@/types'

interface DealPipelineProps {
  columns: PipelineColumn[]
  onMoveDeal?: (dealId: string, toStageId: string) => Promise<void>
}

export function DealPipeline({ columns: initialColumns, onMoveDeal }: DealPipelineProps) {
  const [columns, setColumns] = useState(initialColumns)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const findDeal = useCallback((id: string): DealWithDetails | undefined => {
    for (const col of columns) {
      const deal = col.deals.find(d => d.id === id)
      if (deal) return deal
    }
  }, [columns])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const dealId = active.id as string
    const toStageId = over.id as string

    // Find source stage
    const sourceCol = columns.find(c => c.deals.some(d => d.id === dealId))
    if (!sourceCol || sourceCol.stage.id === toStageId) return

    // Optimistic update
    setColumns(prev => prev.map(col => {
      if (col.stage.id === sourceCol.stage.id) {
        return { ...col, deals: col.deals.filter(d => d.id !== dealId) }
      }
      if (col.stage.id === toStageId) {
        const deal = sourceCol.deals.find(d => d.id === dealId)!
        return { ...col, deals: [...col.deals, deal] }
      }
      return col
    }))

    try {
      await onMoveDeal?.(dealId, toStageId)
    } catch {
      // Revert on error
      setColumns(initialColumns)
    }
  }

  const activeDeal = activeId ? findDeal(activeId) : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(col => (
          <DealStageColumn key={col.stage.id} column={col} />
        ))}
      </div>
      <DragOverlay>
        {activeDeal && (
          <div className="rounded-xl bg-white border border-charcoal-200 shadow-2xl p-4 w-64 opacity-90">
            <p className="font-medium text-charcoal-900 text-sm">{activeDeal.title}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
