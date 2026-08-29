'use client'

import { useState } from 'react'
import { Card } from '@/components/layout'
import { Button } from '@/components/ui'

type SyncInfo = { syncedAt: string; added: number; updated: number; deleted: number; errors: number; notes: string | null } | null

interface Props {
  initialIntervalMinutes: number
  activeListings:         number
  idxSync:                SyncInfo
  mediaSync:              SyncInfo
  dlaSync:                SyncInfo
  offMarketSync:          SyncInfo
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

export function MlsSyncSettingsCard({ initialIntervalMinutes, activeListings, idxSync, mediaSync, dlaSync, offMarketSync, voxMemberSync, voxOfficeSync }: Props) {
  const [selected,   setSelected]   = useState<number>(() => matchPreset(initialIntervalMinutes))
  const [custom,     setCustom]     = useState<string>(String(initialIntervalMinutes))
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [syncing,    setSyncing]    = useState(false)
  const [syncMsg,    setSyncMsg]    = useState<string | null>(null)
  const [resettingType, setResettingType] = useState<string | null>(null)
  const [resetMsg,      setResetMsg]      = useState<string | null>(null)

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

  async function handleForceResync(apiType: string, label: string) {
    setResettingType(apiType)
    setResetMsg(null)
    try {
      const res  = await fetch(`/api/reso/sync?type=${apiType}&reset=true`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      setResetMsg(`${label}: full re-sync started — this rescans PropTx's entire history for this feed, so it can take a while.`)
    } catch (e) {
      setResetMsg(`${label}: failed to start — ${e instanceof Error ? e.message : 'check server logs'}`)
    } finally {
      setResettingType(null)
    }
  }

  return (
    <Card>
      <h3 className="font-semibold text-charcoal-900 mb-1">RESO / MLS Sync</h3>
      <p className="text-sm text-charcoal-400 mb-4">
        Configure how often the MLS data syncs via cron. &ldquo;Sync Now&rdquo; always runs immediately regardless of interval.
        &ldquo;Full re-sync&rdquo; on a row below clears its saved position and rescans that feed&rsquo;s entire history —
        use it if a field was missed on a listing that hasn&rsquo;t changed since, e.g. after a PropTx access-tier issue
        is resolved. Normal incremental syncs never revisit a listing unless PropTx changes it again.
      </p>

      {/* Status row */}
      <div className="rounded-lg bg-charcoal-50 px-4 py-3 text-sm flex flex-col gap-1 mb-4">
        <div className="flex justify-between">
          <span className="text-charcoal-500">Active listings</span>
          <span className="font-medium text-charcoal-900">{activeListings.toLocaleString()}</span>
        </div>
        {([
          { label: 'IDX last sync',        sync: idxSync,       resetType: 'idx'       },
          { label: 'Media (photos) sync',  sync: mediaSync,     resetType: null        },
          { label: 'DLA last sync',        sync: dlaSync,       resetType: 'dla'       },
          { label: 'Off-market sync',      sync: offMarketSync, resetType: 'offmarket' },
          { label: 'VOX members',          sync: voxMemberSync, resetType: null        },
          { label: 'VOX offices',          sync: voxOfficeSync, resetType: null        },
        ] as const).map(({ label, sync, resetType }) => (
          <div key={label} className="flex flex-col">
            <div className="flex justify-between items-center gap-3">
              <span className="text-charcoal-500 shrink-0">{label}</span>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`font-medium truncate ${sync && sync.errors > 0 ? 'text-red-600' : 'text-charcoal-900'}`}>
                  {sync
                    ? `${new Date(sync.syncedAt).toLocaleString()} — ${sync.added} added, ${sync.updated} updated${sync.errors > 0 ? `, ${sync.errors} error(s)` : ''}`
                    : 'Never'}
                </span>
                {resetType && (
                  <button
                    type="button"
                    onClick={() => handleForceResync(resetType, label)}
                    disabled={resettingType === resetType}
                    className="text-xs text-charcoal-400 hover:text-charcoal-900 underline underline-offset-2 disabled:opacity-50 shrink-0"
                  >
                    {resettingType === resetType ? 'Starting…' : 'Full re-sync'}
                  </button>
                )}
              </div>
            </div>
            {sync?.notes && (
              <pre className={`text-xs whitespace-pre-wrap mt-1 mb-1 ${sync.errors > 0 ? 'text-red-600' : 'text-charcoal-400'}`}>{sync.notes}</pre>
            )}
          </div>
        ))}
        {resetMsg && <p className="text-xs text-charcoal-500 mt-1">{resetMsg}</p>}
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
