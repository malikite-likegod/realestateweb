'use client'

import { useRouter } from 'next/navigation'

interface Props { firstName: string | null }

export function PortalHeader({ firstName }: Props) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/portal/logout', { method: 'POST' })
    router.push('/portal/login')
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-semibold text-gray-900">Client Portal</span>
        <nav className="flex gap-4 text-sm">
          <a href="/portal" className="text-gray-600 hover:text-gray-900">Listings</a>
          <a href="/portal/saved" className="text-gray-600 hover:text-gray-900">Saved</a>
          <a href="/portal/saved-searches" className="text-gray-600 hover:text-gray-900">Saved Searches</a>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">{firstName ? `Hi, ${firstName}` : 'Hi'}</span>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-900">Log out</button>
      </div>
    </header>
  )
}
