'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/navigation'
import { Topbar } from './Topbar'
import { ToastProvider } from '@/components/ui'

interface DashboardLayoutProps {
  children: React.ReactNode
  user: { name: string; email: string; avatarUrl?: string | null }
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-charcoal-50">
        <Sidebar collapsed={collapsed} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar user={user} onToggleSidebar={() => setCollapsed(c => !c)} />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
