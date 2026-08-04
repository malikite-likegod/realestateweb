import { Badge } from '@/components/ui'
import { formatPrice } from '@/lib/utils'
import type { AffordabilityInput, AffordabilityResult } from '@/lib/mortgage'
import { CheckCircle2, XCircle } from 'lucide-react'
import { MortgageDisclaimer } from '../MortgageDisclaimer'

interface ResultsPanelProps {
  input: AffordabilityInput
  result: AffordabilityResult
}

export function ResultsPanel({ input, result }: ResultsPanelProps) {
  const notInsurable = input.creditTier === 'poor'

  return (
    <div className="rounded-2xl border border-charcoal-100 bg-white shadow-sm p-6">
      <p className="text-xs uppercase tracking-wide text-charcoal-500 mb-1">Estimated Maximum Purchase Price</p>
      <p className="font-serif text-4xl font-bold text-charcoal-900">
        {notInsurable ? '—' : formatPrice(result.maxPurchasePrice)}
      </p>

      {notInsurable ? (
        <p className="mt-3 text-sm text-charcoal-600">
          A credit score below 600 generally falls outside standard insured or conventional lending
          guidelines. A mortgage broker can advise on alternative or private lending options.
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2">
            {result.passesStressTest ? (
              <Badge variant="success"><span className="inline-flex items-center gap-1"><CheckCircle2 size={12} /> Passes stress test</span></Badge>
            ) : (
              <Badge variant="danger"><span className="inline-flex items-center gap-1"><XCircle size={12} /> Does not pass stress test</span></Badge>
            )}
            <span className="text-xs text-charcoal-500">Qualifying rate: {(result.qualifyingRate * 100).toFixed(2)}%</span>
          </div>

          <MortgageDisclaimer className="mt-5" />

          <div className="mt-6 space-y-4 border-t border-charcoal-100 pt-5">
            <Row label="Estimated Mortgage Amount" value={formatPrice(result.maxMortgagePrincipal)} />
            <Row label="Monthly Payment (at contract rate)" value={`${formatPrice(result.contractRatePayment)}/mo`} />
            <Row label="Monthly Payment (at stress-test rate)" value={`${formatPrice(result.qualifyingRatePayment)}/mo`} />
            <Row label="GDS Ratio" value={`${(result.gdsRatio * 100).toFixed(1)}%`} />
            <Row label="TDS Ratio" value={`${(result.tdsRatio * 100).toFixed(1)}%`} />
            <Row
              label="Minimum Down Payment Required"
              value={formatPrice(result.minDownPaymentRequired.minDownPayment)}
              sub={`${(result.minDownPaymentRequired.minDownPaymentPercent * 100).toFixed(1)}% of purchase price`}
            />
            {result.cmhcPremium && (
              <Row
                label="Est. CMHC Insurance Premium"
                value={formatPrice(result.cmhcPremium.premiumAmount)}
                sub="Financed into your mortgage"
              />
            )}
            <Row
              label="Est. Land Transfer Tax / Closing Fee"
              value={formatPrice(result.landTransferTax.netTax)}
              sub={result.landTransferTax.rebates > 0 ? `After ${formatPrice(result.landTransferTax.rebates)} first-time buyer rebate` : undefined}
            />
          </div>

          <p className="mt-5 text-xs text-charcoal-400">
            Limiting factor:{' '}
            {result.limitingFactor === 'GDS' && 'your gross debt service ratio'}
            {result.limitingFactor === 'TDS' && 'your total debt service ratio'}
            {result.limitingFactor === 'minDownPayment' && 'your available down payment'}
            {result.limitingFactor === 'notInsurable' && 'credit profile'}
          </p>
        </>
      )}
    </div>
  )
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-charcoal-600">{label}</span>
      <div className="text-right">
        <div className="text-sm font-semibold text-charcoal-900">{value}</div>
        {sub && <div className="text-xs text-charcoal-400">{sub}</div>}
      </div>
    </div>
  )
}
