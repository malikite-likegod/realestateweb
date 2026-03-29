import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Badge, Button } from '@/components/ui'
import { formatPrice, parseJsonSafe } from '@/lib/utils'
import { Plus, Edit, Search } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default async function ListingsManagerPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const properties = await prisma.property.findMany({
    orderBy: { createdAt: 'desc' },
    include: { listings: true },
  })

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Listings Manager"
        subtitle={`${properties.length} properties`}
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Listings' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" leftIcon={<Search size={16} />} asChild>
              <Link href="/admin/listings/browse">Browse MLS</Link>
            </Button>
            <Button variant="primary" leftIcon={<Plus size={16} />} asChild>
              <Link href="/admin/listings/new">Add Listing</Link>
            </Button>
          </div>
        }
      />
      <div className="overflow-x-auto rounded-xl border border-charcoal-100">
        <table className="w-full text-sm">
          <thead className="bg-charcoal-50 border-b border-charcoal-100">
            <tr>
              {['Property', 'Price', 'Type', 'Status', 'City', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-charcoal-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-100 bg-white">
            {properties.map(p => {
              const images = parseJsonSafe<string[]>(p.images, [])
              return (
                <tr key={p.id} className="hover:bg-charcoal-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/listings/${p.id}`} className="flex items-center gap-3">
                      <div className="relative h-10 w-14 rounded-lg overflow-hidden bg-charcoal-100 shrink-0">
                        {images[0] && <Image src={images[0]} alt={p.title} fill className="object-cover" sizes="56px" />}
                      </div>
                      <span className="font-medium text-charcoal-900 line-clamp-1">{p.title}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-semibold text-charcoal-900">{formatPrice(p.price)}</td>
                  <td className="px-4 py-3 text-charcoal-600 capitalize">{p.propertyType}</td>
                  <td className="px-4 py-3">
                    <Badge variant={p.status === 'active' ? 'success' : 'default'} className="capitalize">{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-charcoal-500">{p.city}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/listings/${p.id}`} className="p-1.5 text-charcoal-400 hover:text-charcoal-700 inline-block">
                      <Edit size={16} />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  )
}
