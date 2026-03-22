import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Client Portal' }

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}
