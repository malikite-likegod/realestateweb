'use client'

import { Menu, Bell } from 'lucide-react'
import { UserMenu } from '@/components/navigation'
import { CommandPalette } from '@/components/navigation/CommandPalette'

interface TopbarProps {
  user: { name: string; email: string; avatarUrl?: string | null }
  onToggleSidebar?: () => void
}

export function Topbar({ user, onToggleSidebar }: TopbarProps) {
  return (
    <header className="flex h-16 items-center gap-4 border-b border-charcoal-200 bg-white px-4 lg:px-6">
      <button onClick={onToggleSidebar} className="p-2 text-charcoal-500 hover:text-charcoal-900 transition-colors rounded-lg hover:bg-charcoal-100">
        <Menu size={20} />
      </button>
      <div className="flex-1">
        <CommandPalette />
      </div>
      <div className="flex items-center gap-2">
        <button className="relative p-2 text-charcoal-500 hover:text-charcoal-900 transition-colors rounded-lg hover:bg-charcoal-100">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>
        <UserMenu user={user} />
      </div>
    </header>
  )
}
