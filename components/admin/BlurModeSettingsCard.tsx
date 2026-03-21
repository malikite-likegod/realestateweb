'use client'

import { Card } from '@/components/layout'
import { Switch } from '@/components/ui'
import { useBlurMode } from '@/components/admin/BlurModeContext'
import { EyeOff } from 'lucide-react'

export function BlurModeSettingsCard() {
  const { isBlurred, toggle } = useBlurMode()

  return (
    <Card>
      <div className="flex items-start gap-3 mb-1">
        <EyeOff size={18} className="text-charcoal-400 mt-0.5 shrink-0" />
        <h3 className="font-semibold text-charcoal-900">Blur Mode</h3>
      </div>
      <p className="text-sm text-charcoal-400 mb-4">
        Blur sensitive contact details (phone, email, address) during demos or when working in public.
      </p>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-charcoal-900">Enable Blur Mode</p>
          <p className="text-xs text-charcoal-400">Hides contact details across the admin section</p>
        </div>
        <Switch checked={isBlurred} onChange={toggle} />
      </div>
    </Card>
  )
}
