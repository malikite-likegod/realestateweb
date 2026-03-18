'use client'

import { useState } from 'react'
import { Card } from '@/components/layout'
import { Input, Button } from '@/components/ui'

export function ChangePasswordCard() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (form.newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        setLoading(false)
      } else {
        setSuccess(true)
        setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
        // The API clears the auth_token cookie in the response, so the redirect
        // to login will be clean — no error loop from the stale session.
        setTimeout(() => { window.location.href = '/admin/login' }, 1500)
        // Do not call setLoading(false) — keep the button disabled until the redirect unmounts the component.
      }
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Card>
      <h3 className="font-semibold text-charcoal-900 mb-4">Change Password</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Current password"
          type="password"
          required
          value={form.currentPassword}
          onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
        />
        <Input
          label="New password"
          type="password"
          required
          value={form.newPassword}
          onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
        />
        <Input
          label="Confirm new password"
          type="password"
          required
          value={form.confirmPassword}
          onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-green-600">Password changed. Redirecting to login…</p>}
        <Button type="submit" variant="primary" className="self-start" loading={loading}>
          Save Password
        </Button>
      </form>
    </Card>
  )
}
