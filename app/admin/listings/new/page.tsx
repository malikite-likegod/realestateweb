'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Card } from '@/components/layout'
import { Input, Select, Textarea, Button } from '@/components/ui'
import { PROPERTY_TYPES, LISTING_TYPES } from '@/lib/constants'
import { useToast } from '@/components/ui'

export default function NewListingPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', propertyType: 'detached', listingType: 'sale',
    price: '', bedrooms: '', bathrooms: '', sqft: '', address: '', city: 'Toronto',
    province: 'ON', postalCode: '', status: 'active',
  })

  // Requires user session — handled by layout
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, price: Number(form.price), bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined, bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined, sqft: form.sqft ? Number(form.sqft) : undefined }),
      })
      if (!res.ok) throw new Error()
      toast('success', 'Listing created!')
      router.push('/admin/listings')
    } catch {
      toast('error', 'Failed to create listing')
    } finally {
      setLoading(false)
    }
  }

  // Dummy session for client layout (real session in server layout)
  const user = { name: 'Admin', email: '', avatarUrl: null }

  return (
    <DashboardLayout user={user}>
      <PageHeader title="New Listing" breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Listings', href: '/admin/listings' }, { label: 'New' }]} />
      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Title" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <Textarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Property Type" options={PROPERTY_TYPES as unknown as Array<{value:string;label:string}>} value={form.propertyType} onChange={e => setForm(f => ({ ...f, propertyType: e.target.value }))} />
            <Select label="Listing Type" options={LISTING_TYPES as unknown as Array<{value:string;label:string}>} value={form.listingType} onChange={e => setForm(f => ({ ...f, listingType: e.target.value }))} />
          </div>
          <Input label="Price (CAD)" type="number" required value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
          <div className="grid grid-cols-3 gap-4">
            <Input label="Bedrooms" type="number" value={form.bedrooms} onChange={e => setForm(f => ({ ...f, bedrooms: e.target.value }))} />
            <Input label="Bathrooms" type="number" step="0.5" value={form.bathrooms} onChange={e => setForm(f => ({ ...f, bathrooms: e.target.value }))} />
            <Input label="Sqft" type="number" value={form.sqft} onChange={e => setForm(f => ({ ...f, sqft: e.target.value }))} />
          </div>
          <Input label="Address" required value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          <div className="grid grid-cols-3 gap-4">
            <Input label="City" required value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            <Input label="Province" value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} />
            <Input label="Postal Code" value={form.postalCode} onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" variant="primary" loading={loading}>Create Listing</Button>
          </div>
        </form>
      </Card>
    </DashboardLayout>
  )
}
