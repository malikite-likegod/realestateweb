'use client'

import { LogOut, Settings, User } from 'lucide-react'
import { Avatar, Dropdown } from '@/components/ui'

interface UserMenuProps {
  user: { name: string; email: string; avatarUrl?: string | null }
}

export function UserMenu({ user }: UserMenuProps) {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  return (
    <Dropdown
      trigger={
        <button className="flex items-center gap-2.5 rounded-xl p-1.5 hover:bg-charcoal-100 transition-colors">
          <Avatar src={user.avatarUrl} name={user.name} size="sm" />
          <div className="hidden md:flex flex-col items-start">
            <span className="text-sm font-medium text-charcoal-900 leading-none">{user.name}</span>
            <span className="text-xs text-charcoal-500 leading-none mt-0.5">{user.email}</span>
          </div>
        </button>
      }
      items={[
        { label: 'Profile', icon: <User size={14} />, href: '/admin/settings' },
        { label: 'Settings', icon: <Settings size={14} />, href: '/admin/settings' },
        { divider: true, label: '' },
        { label: 'Log Out', icon: <LogOut size={14} />, onClick: handleLogout, danger: true },
      ]}
    />
  )
}
