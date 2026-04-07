'use client'

import { useState, useEffect, useCallback } from 'react'
import { Copy, Trash2, Key } from 'lucide-react'
import { Card } from '@/components/layout'
import { Button, Input } from '@/components/ui'

interface ApiKey {
  id: string
  name: string
  prefix: string
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create form
  const [name, setName] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Revealed key (shown once after creation)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Revoke state
  const [revoking, setRevoking] = useState<string | null>(null)

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/api-keys')
      if (!res.ok) throw new Error('Failed to load API keys')
      const json = await res.json()
      setKeys(json.keys)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchKeys() }, [fetchKeys])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    setNewKey(null)
    setCopied(false)
    try {
      const body: Record<string, string> = { name: name.trim() }
      if (expiresAt) body.expiresAt = expiresAt
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create key')
      setNewKey(json.key)
      setName('')
      setExpiresAt('')
      setKeys(prev => [json.apiKey, ...prev])
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this API key? Any integrations using it will stop working immediately.')) return
    setRevoking(id)
    try {
      const res = await fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to revoke')
      setKeys(prev => prev.filter(k => k.id !== id))
      if (newKey) {
        // If the newly-generated key was revoked, clear the banner too
        setNewKey(null)
      }
    } catch {
      alert('Failed to revoke key. Please try again.')
    } finally {
      setRevoking(null)
    }
  }

  async function handleCopy() {
    if (!newKey) return
    await navigator.clipboard.writeText(newKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Create form */}
      <Card>
        <h3 className="font-semibold text-charcoal-900 mb-4">Generate New API Key</h3>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input
            label="Key name"
            placeholder="e.g. OpenClaw integration"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <Input
            label="Expires (optional)"
            type="date"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
          />
          {createError && (
            <p className="text-sm text-red-600">{createError}</p>
          )}
          <Button variant="primary" type="submit" disabled={creating} className="self-start">
            {creating ? 'Generating…' : 'Generate Key'}
          </Button>
        </form>
      </Card>

      {/* Newly generated key — shown once */}
      {newKey && (
        <Card>
          <div className="flex items-start gap-3">
            <Key size={18} className="text-gold-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-charcoal-900 mb-1">
                Copy your key now — it will not be shown again.
              </p>
              <code className="block text-xs font-mono bg-charcoal-50 border border-charcoal-200 rounded px-3 py-2 break-all select-all">
                {newKey}
              </code>
            </div>
            <button
              onClick={handleCopy}
              className="shrink-0 text-charcoal-400 hover:text-charcoal-700 transition-colors"
              title="Copy to clipboard"
            >
              <Copy size={16} />
            </button>
          </div>
          {copied && <p className="mt-2 text-xs text-green-600 ml-9">Copied!</p>}
        </Card>
      )}

      {/* Key list */}
      <Card>
        <h3 className="font-semibold text-charcoal-900 mb-4">Active Keys</h3>
        {loading && <p className="text-sm text-charcoal-400">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && keys.length === 0 && (
          <p className="text-sm text-charcoal-400">No API keys yet.</p>
        )}
        {keys.length > 0 && (
          <div className="divide-y divide-charcoal-100">
            {keys.map(key => (
              <div key={key.id} className="flex items-center justify-between py-3 gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-charcoal-900 truncate">{key.name}</p>
                  <p className="text-xs text-charcoal-400 font-mono mt-0.5">
                    {key.prefix}••••••••••••••••••••••••••••••••••
                  </p>
                  <div className="flex flex-wrap gap-x-4 mt-1 text-xs text-charcoal-400">
                    <span>Created {formatDate(key.createdAt)}</span>
                    {key.expiresAt && <span>Expires {formatDate(key.expiresAt)}</span>}
                    {key.lastUsedAt
                      ? <span>Last used {formatDate(key.lastUsedAt)}</span>
                      : <span>Never used</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(key.id)}
                  disabled={revoking === key.id}
                  className="shrink-0 text-charcoal-400 hover:text-red-600 transition-colors disabled:opacity-40"
                  title="Revoke key"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
