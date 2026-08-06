import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function RentVsBuyDisclaimer({ className }: { className?: string }) {
  return (
    <div
      role="note"
      aria-label="Rent vs Buy Disclaimer"
      className={cn('flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5', className)}
    >
      <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" />
      <p className="text-sm text-amber-900 leading-relaxed">
        This tool provides rough estimates only and does not constitute financial, mortgage, or real-estate advice.
        Actual mortgage payments depend on interest rates, down payment, credit, taxes, insurance, and other factors.
        Please contact a licensed mortgage professional and real-estate agent for a personalized assessment.
      </p>
    </div>
  )
}
