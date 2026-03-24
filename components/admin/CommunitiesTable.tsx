'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Edit, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui'

export interface CommunityRow {
  id:           string
  name:         string
  slug:         string
  city:         string
  imageUrl:     string | null
  displayOrder: number
  listingCount: number
}

interface CommunitiesTableProps {
  communities: CommunityRow[]
}

export function CommunitiesTable({ communities }: CommunitiesTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete community "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/admin/communities/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast('success', 'Community deleted')
      router.refresh()
    } catch {
      toast('error', 'Failed to delete community')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-charcoal-100">
      <table className="w-full text-sm">
        <thead className="bg-charcoal-50 border-b border-charcoal-100">
          <tr>
            {['Image', 'Name', 'City', 'Listings', 'Order', 'Actions'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-charcoal-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-charcoal-100 bg-white">
          {communities.map(c => (
            <tr key={c.id} className="hover:bg-charcoal-50 transition-colors">
              <td className="px-4 py-3">
                <div className="relative h-10 w-14 rounded-lg overflow-hidden bg-charcoal-100 shrink-0">
                  {c.imageUrl && (
                    <Image src={c.imageUrl} alt={c.name} fill className="object-cover" sizes="56px" />
                  )}
                </div>
              </td>
              <td className="px-4 py-3 font-medium text-charcoal-900">{c.name}</td>
              <td className="px-4 py-3 text-charcoal-600">{c.city}</td>
              <td className="px-4 py-3 text-charcoal-600">{c.listingCount}</td>
              <td className="px-4 py-3 text-charcoal-400">{c.displayOrder}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Link href={`/admin/communities/${c.id}/edit`} className="p-1.5 text-charcoal-400 hover:text-charcoal-700">
                    <Edit size={16} />
                  </Link>
                  <button
                    onClick={() => handleDelete(c.id, c.name)}
                    disabled={deleting === c.id}
                    className="p-1.5 text-charcoal-400 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {communities.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-charcoal-400">
                No communities yet.{' '}
                <Link href="/admin/communities/new" className="text-charcoal-700 underline">
                  Add one.
                </Link>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
