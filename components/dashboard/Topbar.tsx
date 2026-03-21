'use client'

import { Menu, Eye, EyeOff } from 'lucide-react'
import { UserMenu } from '@/components/navigation'
import { CommandPalette } from '@/components/navigation/CommandPalette'
import { NotificationBell } from './NotificationBell'
import { useBlurMode } from '@/components/admin/BlurModeContext'

interface TopbarProps {
  user: { name: string; email: string; avatarUrl?: string | null }
  onToggleSidebar?: () => void
}

export function Topbar({ user, onToggleSidebar }: TopbarProps) {
  const { isBlurred, toggle } = useBlurMode()
  return (
    <header className="flex h-16 items-center gap-4 border-b border-charcoal-200 bg-white px-4 lg:px-6">
      <button onClick={onToggleSidebar} className="p-2 text-charcoal-500 hover:text-charcoal-900 transition-colors rounded-lg hover:bg-charcoal-100">
        <Menu size={20} />
      </button>
      <div className="flex-1">
        <CommandPalette />
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <button
          onClick={toggle}
          title={isBlurred ? 'Blur Mode on — click to disable' : 'Blur Mode off — click to enable'}
          className={`p-2 rounded-lg transition-colors ${
            isBlurred
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              : 'text-charcoal-500 hover:text-charcoal-900 hover:bg-charcoal-100'
          }`}
        >
          {isBlurred ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
        <UserMenu user={user} />
      </div>
    </header>
  )
}
