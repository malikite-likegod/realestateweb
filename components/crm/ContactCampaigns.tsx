'use client'

/**
 * ContactCampaigns
 *
 * Shows a contact's drip campaign enrollments and lets the user
 * enroll them in a new campaign or cancel an active one.
 */

import { useState } from 'react'
import { Zap, CheckCircle, XCircle, PauseCircle, Clock, Plus } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { formatDate } from '@/lib/utils'

type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'cancelled'

type Enrollment = {
  id:           string
  status:       EnrollmentStatus
  currentStep:  number
  enrolledAt:   string | Date
  completedAt:  string | Date | null
  sequence: {
    id:         string
    name:       string
    trigger:    string
    totalSteps: number
  }
}

type AvailableCampaign = {
  id:      string
  name:    string
  trigger: string
}

type CampaignStep = {
  id:           string
  order:        number
  type:         string
  delayMinutes: number
}

interface ContactCampaignsProps {
  contactId:          string
  initialEnrollments: Enrollment[]
  availableCampaigns: AvailableCampaign[]
}

const STATUS_CONFIG: Record<EnrollmentStatus, { label: string; variant: 'success' | 'default' | 'info' | 'gold'; icon: React.ReactNode }> = {
  active:    { label: 'Active',    variant: 'success', icon: <Zap        size={12} className="text-green-500" /> },
  paused:    { label: 'Paused',    variant: 'gold',    icon: <PauseCircle size={12} className="text-amber-500" /> },
  completed: { label: 'Completed', variant: 'info',    icon: <CheckCircle size={12} className="text-blue-500" /> },
  cancelled: { label: 'Unenrolled', variant: 'default', icon: <XCircle    size={12} className="text-charcoal-400" /> },
}

export function ContactCampaigns({ contactId, initialEnrollments, availableCampaigns }: ContactCampaignsProps) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>(initialEnrollments)
  const [selectedId,   setSelectedId]   = useState('')
  const [steps,        setSteps]        = useState<CampaignStep[]>([])
  const [startAtStep,  setStartAtStep]  = useState(0)
  const [loadingSteps, setLoadingSteps] = useState(false)
  const [enrolling,    setEnrolling]    = useState(false)
  const [error,        setError]        = useState('')

  // Campaigns the contact isn't already actively enrolled in
  const enrolledSequenceIds = new Set(
    enrollments.filter(e => e.status === 'active' || e.status === 'paused').map(e => e.sequence.id)
  )
  const unenrolledCampaigns = availableCampaigns.filter(c => !enrolledSequenceIds.has(c.id))

  async function handleCampaignSelect(id: string) {
    setSelectedId(id)
    setStartAtStep(0)
    setSteps([])
    if (!id) return
    setLoadingSteps(true)
    try {
      const res  = await fetch(`/api/campaigns/${id}/steps`)
      const json = await res.json()
      if (json.data) setSteps(json.data)
    } finally {
      setLoadingSteps(false)
    }
  }

  async function handleEnroll() {
    if (!selectedId) return
    setEnrolling(true)
    setError('')
    try {
      const res  = await fetch(`/api/campaigns/${selectedId}/enroll`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ contactId, startAtStep }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Enrollment failed')

      // Refresh enrollments from server
      await refreshEnrollments()
      setSelectedId('')
      setSteps([])
      setStartAtStep(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll')
    } finally {
      setEnrolling(false)
    }
  }

  async function refreshEnrollments() {
    const res  = await fetch(`/api/contacts/${contactId}/campaigns`)
    const json = await res.json()
    if (json.data) setEnrollments(json.data)
  }

  async function updateEnrollmentStatus(enrollmentId: string, status: 'cancelled' | 'paused' | 'active') {
    setError('')
    try {
      const res  = await fetch(`/api/campaigns/enrollments/${enrollmentId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to update enrollment')
      setEnrollments(prev =>
        prev.map(e => e.id === enrollmentId ? { ...e, status } : e)
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update enrollment')
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Enroll section */}
      {unenrolledCampaigns.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <select
              value={selectedId}
              onChange={e => handleCampaignSelect(e.target.value)}
              className="flex-1 rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
            >
              <option value="">Select a campaign to enroll…</option>
              {unenrolledCampaigns.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.trigger.replace(/_/g, ' ')})
                </option>
              ))}
            </select>
            <Button
              variant="primary" size="sm"
              leftIcon={<Plus size={14} />}
              loading={enrolling}
              onClick={handleEnroll}
              disabled={!selectedId}>
              Enroll
            </Button>
          </div>
          {selectedId && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-charcoal-500 shrink-0">Start at step:</label>
              <select
                value={startAtStep}
                onChange={e => setStartAtStep(Number(e.target.value))}
                disabled={loadingSteps || steps.length === 0}
                className="rounded-lg border border-charcoal-200 bg-white px-3 py-1.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900 disabled:opacity-50"
              >
                {steps.length === 0
                  ? <option value={0}>{loadingSteps ? 'Loading…' : 'Step 1'}</option>
                  : steps.map((s, i) => (
                    <option key={s.id} value={i}>
                      Step {i + 1}: {s.type.replace(/_/g, ' ')}
                      {s.delayMinutes > 0 ? ` (after ${s.delayMinutes >= 1440 ? `${s.delayMinutes / 1440}d` : `${s.delayMinutes}m`} delay)` : ''}
                    </option>
                  ))
                }
              </select>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Enrollment list */}
      {enrollments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-charcoal-100">
            <Zap size={20} className="text-charcoal-400" />
          </div>
          <p className="text-sm text-charcoal-500">Not enrolled in any drip campaigns.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {enrollments.map(e => {
            const cfg = STATUS_CONFIG[e.status]
            return (
              <div key={e.id} className="rounded-xl border border-charcoal-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {cfg.icon}
                      <span className="font-semibold text-charcoal-900 text-sm truncate">{e.sequence.name}</span>
                      <Badge variant={cfg.variant} className="text-xs shrink-0">{cfg.label}</Badge>
                    </div>
                    <p className="text-xs text-charcoal-400 capitalize mb-1">
                      Trigger: {e.sequence.trigger.replace(/_/g, ' ')}
                    </p>
                    {(e.status === 'active' || e.status === 'paused') ? (
                      <div className="flex items-center gap-1.5 text-xs text-charcoal-500">
                        <Clock size={11} />
                        Step {e.currentStep + 1} of {e.sequence.totalSteps}
                        <span className="text-charcoal-300">·</span>
                        Enrolled {formatDate(new Date(e.enrolledAt), { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    ) : (
                      <p className="text-xs text-charcoal-400">
                        Enrolled {formatDate(new Date(e.enrolledAt), { month: 'short', day: 'numeric', year: 'numeric' })}
                        {e.completedAt && (
                          <> · {e.status === 'completed' ? 'Completed' : 'Unenrolled'} {formatDate(new Date(e.completedAt), { month: 'short', day: 'numeric', year: 'numeric' })}</>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {e.status === 'active' && (
                      <>
                        <button
                          onClick={() => updateEnrollmentStatus(e.id, 'paused')}
                          className="rounded px-2 py-1 text-xs text-charcoal-500 hover:bg-charcoal-100 transition-colors">
                          Pause
                        </button>
                        <button
                          onClick={() => updateEnrollmentStatus(e.id, 'cancelled')}
                          className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors">
                          Unenroll
                        </button>
                      </>
                    )}
                    {e.status === 'paused' && (
                      <>
                        <button
                          onClick={() => updateEnrollmentStatus(e.id, 'active')}
                          className="rounded px-2 py-1 text-xs text-green-600 hover:bg-green-50 transition-colors">
                          Resume
                        </button>
                        <button
                          onClick={() => updateEnrollmentStatus(e.id, 'cancelled')}
                          className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors">
                          Unenroll
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {unenrolledCampaigns.length === 0 && availableCampaigns.length > 0 && (
        <p className="text-xs text-charcoal-400 text-center">Contact is enrolled in all available campaigns.</p>
      )}

      {availableCampaigns.length === 0 && (
        <p className="text-xs text-charcoal-400 text-center">
          No active campaigns exist yet. <a href="/admin/automation" className="text-gold-600 hover:underline">Create one</a> in the Automation Manager.
        </p>
      )}
    </div>
  )
}
