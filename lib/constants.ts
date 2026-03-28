export const APP_NAME = 'Michael Taylor Real Estate'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const PROPERTY_CLASSES = [
  { value: 'Residential', label: 'Residential' },
  { value: 'Commercial',  label: 'Commercial'  },
] as const

export const PROPERTY_TYPES = [
  { value: 'detached', label: 'Detached House' },
  { value: 'semi', label: 'Semi-Detached' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'land', label: 'Land' },
] as const

export const LISTING_TYPES = [
  { value: 'sale', label: 'For Sale' },
  { value: 'rent', label: 'For Rent' },
  { value: 'lease', label: 'For Lease' },
] as const

export const DEAL_STAGES_DEFAULT = [
  { name: 'New Lead', order: 1, color: '#6366f1' },
  { name: 'Contacted', order: 2, color: '#8b5cf6' },
  { name: 'Showing', order: 3, color: '#f59e0b' },
  { name: 'Offer Made', order: 4, color: '#ef4444' },
  { name: 'Under Contract', order: 5, color: '#10b981' },
  { name: 'Closed', order: 6, color: '#059669' },
]

export const NAV_LINKS = [
  { label: 'Buy', href: '/buying' },
  { label: 'Sell', href: '/selling' },
  { label: 'Listings', href: '/listings' },
  { label: 'Communities', href: '/communities' },
  { label: 'Blog', href: '/blog' },
  { label: 'Relocation', href: '/relocation' },
  { label: 'Contact', href: '/contact' },
] as const
