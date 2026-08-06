import { formatPrice } from '@/lib/utils'
import type { RentVsBuyAssumptions } from '@/lib/rent-vs-buy'

interface CostSummaryPanelProps {
  monthlyRent: number
  otherCostsTotal: number
  totalMonthlyCost: number
  toleranceDollars: number
  assumptions: RentVsBuyAssumptions
}

export function CostSummaryPanel({ monthlyRent, otherCostsTotal, totalMonthlyCost, toleranceDollars, assumptions }: CostSummaryPanelProps) {
  return (
    <div className="rounded-2xl border border-charcoal-100 bg-white shadow-sm p-6">
      <p className="text-xs uppercase tracking-wide text-charcoal-500 mb-1">Your Total Monthly Housing Cost</p>
      <p className="font-serif text-4xl font-bold text-charcoal-900">
        {formatPrice(totalMonthlyCost)}
        <span className="text-sm font-normal text-charcoal-500"> /mo</span>
      </p>

      <div className="mt-4 space-y-2 border-t border-charcoal-100 pt-4">
        <Row label="Monthly Rent" value={formatPrice(monthlyRent)} />
        <Row label="Other Lease Costs" value={formatPrice(otherCostsTotal)} />
      </div>

      <div className="mt-5 rounded-xl bg-charcoal-50 p-4">
        <p className="text-xs uppercase tracking-wide text-charcoal-500 mb-1">We&apos;re Looking For a Payment Near</p>
        <p className="text-sm font-semibold text-charcoal-900">
          {formatPrice(Math.max(totalMonthlyCost - toleranceDollars, 0))} – {formatPrice(totalMonthlyCost + toleranceDollars)} /mo
        </p>
        <p className="mt-1 text-xs text-charcoal-500">Within ${toleranceDollars} of your current housing cost.</p>
      </div>

      <div className="mt-5 border-t border-charcoal-100 pt-4">
        <p className="text-xs uppercase tracking-wide text-charcoal-500 mb-2">How the Payment Estimate Works</p>
        <ul className="space-y-1 text-xs text-charcoal-600 list-disc pl-4">
          <li>{(assumptions.downPaymentPercent * 100).toFixed(0)}% down payment</li>
          <li>{assumptions.amortizationYears}-year amortization</li>
          <li>{(assumptions.contractRate * 100).toFixed(2)}% current average rate</li>
          <li>Principal &amp; interest only — property tax, insurance, condo fees, and closing costs are not included</li>
        </ul>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-charcoal-600">{label}</span>
      <span className="text-sm font-semibold text-charcoal-900">{value}</span>
    </div>
  )
}
