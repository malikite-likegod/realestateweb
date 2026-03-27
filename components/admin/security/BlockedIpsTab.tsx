'use client'

import { useState } from 'react'
import { BlockedIpsUpload } from './BlockedIpsUpload'
import { BlockedIpsTable }  from './BlockedIpsTable'

export function BlockedIpsTab() {
  const [refreshKey, setRefreshKey] = useState(0)
  return (
    <div className="space-y-8">
      <BlockedIpsUpload onUploaded={() => setRefreshKey(k => k + 1)} />
      <hr className="border-gray-200" />
      <BlockedIpsTable refreshKey={refreshKey} />
    </div>
  )
}
