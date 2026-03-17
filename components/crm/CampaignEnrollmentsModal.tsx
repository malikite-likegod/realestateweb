'use client'

/**
 * CampaignEnrollmentsModal
 *
 * Opens a paginated table of all enrollments for a campaign.
 * Supports Pause, Resume, and Unenroll actions per row.
 */

import { useState, useEffect } from 'react'
import { Users } from 'lucide-react'
import { Modal, Badge, Button } from '@/components/ui'
import { formatDate } from '@/lib/utils'

type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'cancelled'

type EnrollmentRow = {
  id:          string
  status:      EnrollmentStatus
  currentStep: number
  nextRunAt:   string | null
  enrolledAt:  string
  completedAt: string | null
  contact: {
    id:        string
    firstName: string
    lastName:  string
    email:     string | null
  }
}

interface Props {
  open:         boolean
  onClose:      () => void
  campaignId:   string
  campaignName: string
  totalSteps:   number
}

const STATUS_CONFIG: Record<EnrollmentStatus, { label: string; variant: 'success' | 'gold' | 'info' | 'default' }> = {
  active:    { label: 'Active',     variant: 'success' },
  paused:    { label: 'Paused',     variant: 'gold'    },
  completed: { label: 'Completed',  variant: 'info'    },
  cancelled: { label: 'Unenrolled', variant: 'default' },
}

const PAGE_SIZE = 25

export function CampaignEnrollmentsModal({ open, onClose, campaignId, campaignName, totalSteps }: Props) {
  const [rows,       setRows]       = useState<EnrollmentRow[]>([])
  const [total,      setTotal]      = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page,       setPage]       = useState(1)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    if (!open) return
    setPage(1)
    fetchPage(1)
  }, [open, campaignId])

  async function fetchPage(p: number) {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch(`/api/campaigns/${campaignId}/enrollments?page=${p}&pageSize=${PAGE_SIZE}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load enrollments')
      setRows(json.data)
      setTotal(json.total)
      setTotalPages(json.totalPages)
      setPage(p)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enrollments')
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(enrollmentId: string, status: 'active' | 'paused' | 'cancelled') {
    setError('')
    try {
      const res  = await fetch(`/api/campaigns/enrollments/${enrollmentId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to update enrollment')
      setRows(prev => prev.map(r => r.id === enrollmentId ? { ...r, status } : r))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update enrollment')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={campaignName} size="xl">
      <div className="flex flex-col gap-4">

        {/* Count */}
        <p className="text-sm text-charcoal-500 flex items-center gap-1.5">
          <Users size={14} />
          {loading ? 'Loading…' : `${total} enrollment${total !== 1 ? 's' : ''}`}
        </p>

        {error && <p className="text-xs text-red-600">{error}</p>}

        {/* Table */}
        {!loading && rows.length === 0 && !error && (
          <p className="text-sm text-charcoal-400 text-center py-10">No enrollments yet.</p>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal-100 text-xs text-charcoal-500 uppercase tracking-wide">
                  <th className="pb-2 text-left font-medium">Contact</th>
                  <th className="pb-2 text-left font-medium">Step</th>
                  <th className="pb-2 text-left font-medium">Status</th>
                  <th className="pb-2 text-left font-medium">Next run</th>
                  <th className="pb-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-50">
                {rows.map(row => {
                  const cfg = STATUS_CONFIG[row.status]
                  return (
                    <tr key={row.id} className="hover:bg-charcoal-50 transition-colors">
                      <td className="py-2.5 pr-4">
                        <p className="font-medium text-charcoal-900">
                          {row.contact.firstName} {row.contact.lastName}
                        </p>
                        {row.contact.email && (
                          <p className="text-xs text-charcoal-400">{row.contact.email}</p>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-charcoal-600 whitespace-nowrap">
                        {row.currentStep + 1} of {totalSteps}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-charcoal-500 whitespace-nowrap">
                        {row.nextRunAt
                          ? formatDate(new Date(row.nextRunAt), { month: 'short', day: 'numeric' })
                          : '—'
                        }
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {row.status === 'active' && (
                            <>
                              <button
                                onClick={() => updateStatus(row.id, 'paused')}
                                className="rounded px-2 py-1 text-xs text-charcoal-500 hover:bg-charcoal-100 transition-colors">
                                Pause
                              </button>
                              <button
                                onClick={() => updateStatus(row.id, 'cancelled')}
                                className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors">
                                Unenroll
                              </button>
                            </>
                          )}
                          {row.status === 'paused' && (
                            <>
                              <button
                                onClick={() => updateStatus(row.id, 'active')}
                                className="rounded px-2 py-1 text-xs text-green-600 hover:bg-green-50 transition-colors">
                                Resume
                              </button>
                              <button
                                onClick={() => updateStatus(row.id, 'cancelled')}
                                className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors">
                                Unenroll
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-charcoal-100">
            <p className="text-xs text-charcoal-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost" size="sm"
                disabled={page <= 1}
                onClick={() => fetchPage(page - 1)}>
                Previous
              </Button>
              <Button
                variant="ghost" size="sm"
                disabled={page >= totalPages}
                onClick={() => fetchPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}

      </div>
    </Modal>
  )
}
