'use client'

import { useState } from 'react'
import { Card } from '@/components/layout'
import { Button } from '@/components/ui'

type SyncInfo = { syncedAt: string; added: number; updated: number; deleted: number } | null

interface Props {
  initialIntervalMinutes: number
  activeListings:         number
  idxSync:                SyncInfo
  dlaSync:                SyncInfo
  voxMemberSync:          SyncInfo
  voxOfficeSync:          SyncInfo
}

const PRESETS = [
  { label: '15 minutes',  value: 15   },
  { label: '30 minutes',  value: 30   },
  { label: '1 hour',      value: 60   },
  { label: '2 hours',     value: 120  },
  { label: '4 hours',     value: 240  },
  { label: '6 hours',     value: 360  },
  { label: '12 hours',    value: 720  },
  { label: '24 hours',    value: 1440 },
  { label: 'Custom',      value: -1   },
]

const SELECT_CLASS = 'rounded-lg border border-charcoal-200 bg-white px-3 py-2.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900'
const INPUT_CLASS  = 'w-28 rounded-lg border border-charcoal-200 bg-white px-3 py-2.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900'

function matchPreset(minutes: number) {
  return PRESETS.find(p => p.value === minutes) ? minutes : -1
}

export function MlsSyncSettingsCard({ initialIntervalMinutes, activeListings, idxSync, dlaSync, voxMemberSync, voxOfficeSync }: Props) {
  const [selected,   setSelected]   = useState<number>(() => matchPreset(initialIntervalMinutes))
  const [custom,     setCustom]     = useState<string>(String(initialIntervalMinutes))
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [syncing,    setSyncing]    = useState(false)
  const [syncMsg,    setSyncMsg]    = useState<string | null>(null)

  const effectiveMinutes = selected === -1 ? parseInt(custom, 10) || 0 : selected

  async function handleSave() {
    if (effectiveMinutes < 1) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mls_sync_interval_minutes: String(effectiveMinutes) }),
      })
      if (!res.ok) {
        setSyncMsg('Failed to save — check server logs')
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      setSyncMsg('Failed to save — check server logs')
    } finally {
      setSaving(false)
    }
  }

  async function handleSyncNow() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res  = await fetch('/api/reso/sync?type=all&force=true', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      // Sync runs in background — poll for completion
      setSyncMsg('Sync started in background — check back in a few minutes')
    } catch (e) {
      setSyncMsg(`Sync failed — ${e instanceof Error ? e.message : 'check server logs'}`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Card>
      <h3 className="font-semibold text-charcoal-900 mb-1">RESO / MLS Sync</h3>
      <p className="text-sm text-charcoal-400 mb-4">
        Configure how often the MLS data syncs via cron. &ldquo;Sync Now&rdquo; always runs immediately regardless of interval.
      </p>

      {/* Status row */}
      <div className="rounded-lg bg-charcoal-50 px-4 py-3 text-sm flex flex-col gap-1 mb-4">
        <div className="flex justify-between">
          <span className="text-charcoal-500">Active listings</span>
          <span className="font-medium text-charcoal-900">{activeListings.toLocaleString()}</span>
        </div>
        {([
          { label: 'IDX last sync',    sync: idxSync       },
          { label: 'DLA last sync',    sync: dlaSync       },
          { label: 'VOX members',      sync: voxMemberSync },
          { label: 'VOX offices',      sync: voxOfficeSync },
        ] as const).map(({ label, sync }) => (
          <div key={label} className="flex justify-between">
            <span className="text-charcoal-500">{label}</span>
            <span className="font-medium text-charcoal-900">
              {sync
                ? `${new Date(sync.syncedAt).toLocaleString()} — ${sync.added} added, ${sync.updated} updated`
                : 'Never'}
            </span>
          </div>
        ))}
      </div>

      {/* Interval selector */}
      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1.5">Cron sync interval</label>
          <div className="flex items-center gap-3">
            <select
              className={SELECT_CLASS}
              value={selected}
              onChange={e => {
                const v = parseInt(e.target.value, 10)
                setSelected(v)
                if (v !== -1) setCustom(String(v))
              }}
            >
              {PRESETS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {selected === -1 && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={custom}
                  onChange={e => setCustom(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="60"
                />
                <span className="text-sm text-charcoal-500">minutes</span>
              </div>
            )}
          </div>
          {effectiveMinutes > 0 && (
            <p className="text-xs text-charcoal-400 mt-1.5">
              Cron will sync every <strong>{effectiveMinutes} minute{effectiveMinutes !== 1 ? 's' : ''}</strong> when called by your scheduler.
            </p>
          )}
        </div>

        <div className="flex gap-3 items-center">
          <Button variant="primary" className="self-start" onClick={handleSave} disabled={saving || effectiveMinutes < 1}>
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Interval'}
          </Button>
          <Button variant="outline" onClick={handleSyncNow} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync Now'}
          </Button>
        </div>

        {syncMsg && (
          <p className="text-sm text-charcoal-500">{syncMsg}</p>
        )}
      </div>
    </Card>
  )
}
