'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Users, Briefcase, CheckSquare, Activity,
  Home, FileText, BarChart2, Zap, Settings, LogOut, Building2, MessageCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_NAME } from '@/lib/constants'

const navItems = [
  { label: 'Dashboard',   href: '/admin/dashboard',   icon: LayoutDashboard },
  { label: 'Contacts',    href: '/admin/contacts',    icon: Users },
  { label: 'Deals',       href: '/admin/deals',       icon: Briefcase },
  { label: 'Tasks',          href: '/admin/tasks',          icon: CheckSquare },
  { label: 'Communications', href: '/admin/communications', icon: MessageCircle },
  { label: 'Activities',     href: '/admin/activities',     icon: Activity },
  { label: 'Listings',    href: '/admin/listings',    icon: Building2 },
  { label: 'Blog',        href: '/admin/blog',        icon: FileText },
  { label: 'Analytics',   href: '/admin/analytics',   icon: BarChart2 },
  { label: 'Automation',  href: '/admin/automation',  icon: Zap },
  { label: 'Settings',    href: '/admin/settings',    icon: Settings },
]

interface SidebarProps {
  collapsed?: boolean
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const pathname = usePathname()
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      className="flex flex-col h-full bg-charcoal-950 border-r border-charcoal-800 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex h-16 items-center px-4 border-b border-charcoal-800">
        {!collapsed && (
          <Link href="/admin/dashboard">
            <span className="font-serif text-lg font-bold text-white">{APP_NAME}</span>
          </Link>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 flex flex-col gap-0.5 px-2">
        {navItems.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-charcoal-800 text-white'
                  : 'text-charcoal-400 hover:bg-charcoal-800 hover:text-white',
              )}
            >
              <item.icon size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-charcoal-800 p-2">
        <Link href="/" className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-charcoal-400 hover:text-white hover:bg-charcoal-800 transition-colors'
        )}>
          <Home size={18} className="shrink-0" />
          {!collapsed && <span>View Site</span>}
        </Link>
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-charcoal-400 hover:text-red-400 hover:bg-charcoal-800 transition-colors">
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Log Out</span>}
        </button>
      </div>
    </motion.aside>
  )
}
