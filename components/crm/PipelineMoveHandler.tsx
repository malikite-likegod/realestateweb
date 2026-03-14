'use client'

/**
 * PipelineMoveHandler
 *
 * Client component that owns the onMoveDeal PATCH callback and renders
 * DealPipeline internally. Accepts only plain serializable data props from
 * the server component — no functions cross the server/client boundary.
 */

import { useCallback } from 'react'
import { useToast } from '@/components/ui'
import { DealPipeline } from './DealPipeline'
import type { PipelineColumn } from '@/types'

interface Stage { id: string; name: string; color: string }

interface Props {
  columns: PipelineColumn[]
  stages:  Stage[]
}

export function PipelineMoveHandler({ columns, stages }: Props) {
  const { toast } = useToast()

  const onMoveDeal = useCallback(async (dealId: string, toStageId: string) => {
    const res = await fetch(`/api/deals/${dealId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ stageId: toStageId }),
    })
    if (!res.ok) {
      toast('error', 'Failed to move deal', 'Changes were reverted.')
      throw new Error('Move failed')
    }
    toast('success', 'Deal moved')
  }, [toast])

  return <DealPipeline columns={columns} stages={stages} onMoveDeal={onMoveDeal} />
}
