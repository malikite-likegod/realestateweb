'use client'
import { Button } from '@/components/ui'

interface Props {
  count:        number
  onSend:       () => void
  onSaveSearch: () => void
  onClear:      () => void
}

export function SelectionBar({ count, onSend, onSaveSearch, onClear }: Props) {
  if (count === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-charcoal-900 text-white px-6 py-4 flex items-center justify-between shadow-lg">
      <p className="font-medium">{count} listing{count !== 1 ? 's' : ''} selected</p>
      <div className="flex gap-3 items-center">
        <Button variant="outline" onClick={onSaveSearch} className="text-white border-white hover:bg-charcoal-700">
          Save Search for Contact
        </Button>
        <Button variant="gold" onClick={onSend}>Send to Contact</Button>
        <Button variant="ghost" size="sm" onClick={onClear} className="text-charcoal-400 hover:text-white ml-2">Clear selection</Button>
      </div>
    </div>
  )
}
