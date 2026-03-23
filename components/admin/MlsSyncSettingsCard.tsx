'use client'

import { useState } from 'react'
import { Card } from '@/components/layout'
import { Button, Input } from '@/components/ui'

type SyncInfo = { syncedAt: string; added: number; updated: number; deleted: number } | null

interface Props {
  initialIntervalMinutes: number
  activeListings:         number
  idxSync:                SyncInfo
  dlaSync:                SyncInfo
  voxMemberSync:          SyncInfo
  voxOfficeSync:          SyncInfo
}

export function MlsSyncSettingsCard({ initialIntervalMinutes, activeListings, idxSync, dlaSync, voxMemberSync, voxOfficeSync }: Props) {
  const [interval, setInterval] = useState(String(initialIntervalMinutes))
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [syncing,  setSyncing]  = useState(false)
  const [syncMsg,  setSyncMsg]  = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    await fetch('/api/admin/settings', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ mls_sync_interval_minutes: interval }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleSyncNow() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/reso/sync', { method: 'POST' })
      const r   = await res.json()
      setSyncMsg(`IDX sync complete — ${r.added} added, ${r.updated} updated, ${r.removed} removed`)
    } catch {
      setSyncMsg('Sync failed — check server logs')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Card>
      <h3 className="font-semibold text-charcoal-900 mb-1">RESO / MLS Sync</h3>
      <p className="text-sm text-charcoal-400 mb-4">
        Configure how often the MLS data is synced and trigger a manual sync.
      </p>

      {/* Status row */}
      <div className="rounded-lg bg-charcoal-50 px-4 py-3 text-sm flex flex-col gap-1">
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

      <div className="flex flex-col gap-4 mt-4">
        <Input
          label="Sync interval (minutes)"
          type="number"
          min={1}
          value={interval}
          onChange={e => setInterval(e.target.value)}
        />

        <div className="flex gap-3 items-center">
          <Button
            variant="primary"
            className="self-start"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
          </Button>

          <Button
            variant="outline"
            onClick={handleSyncNow}
            disabled={syncing}
          >
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
