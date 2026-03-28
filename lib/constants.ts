export const APP_NAME = 'Michael Taylor Real Estate'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const PROPERTY_CLASSES = [
  { value: 'Residential', label: 'Residential' },
  { value: 'Commercial',  label: 'Commercial'  },
] as const

// TRREB/RESO PropertySubType values — used with startsWith filter
export const RESIDENTIAL_PROPERTY_TYPES = [
  { value: 'Detached',         label: 'Detached'           },
  { value: 'Semi-Detached',    label: 'Semi-Detached'      },
  { value: 'Att/Row',          label: 'Townhouse / Row'    },
  { value: 'Condo Apt',        label: 'Condo Apartment'    },
  { value: 'Condo Townhouse',  label: 'Condo Townhouse'    },
  { value: 'Link',             label: 'Link'               },
  { value: 'Multiplex',        label: 'Multiplex'          },
  { value: 'Co-Op',            label: 'Co-Op Apartment'    },
] as const

export const COMMERCIAL_PROPERTY_TYPES = [
  { value: 'Commercial/Retail', label: 'Commercial / Retail' },
  { value: 'Sale Of Business',  label: 'Sale of Business'    },
  { value: 'Industrial',        label: 'Industrial'          },
  { value: 'Office',            label: 'Office'              },
  { value: 'Investment',        label: 'Investment'          },
  { value: 'Land',              label: 'Land'                },
] as const

// Legacy constant kept for admin/manual-property forms
export const PROPERTY_TYPES = [
  { value: 'detached',   label: 'Detached House' },
  { value: 'semi',       label: 'Semi-Detached'  },
  { value: 'condo',      label: 'Condo'          },
  { value: 'townhouse',  label: 'Townhouse'      },
  { value: 'commercial', label: 'Commercial'     },
  { value: 'land',       label: 'Land'           },
] as const

export const LISTING_TYPES = [
  { value: 'sale',  label: 'For Sale'  },
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
