import { Accordion } from '@/components/ui'
import { formatPrice } from '@/lib/utils'
import { GDS_TDS_LIMITS, STRESS_TEST } from '@/lib/mortgage'
import type { AffordabilityInput, AffordabilityResult } from '@/lib/mortgage'

interface CalculationBreakdownAccordionProps {
  input: AffordabilityInput
  result: AffordabilityResult
}

export function CalculationBreakdownAccordion({ input, result }: CalculationBreakdownAccordionProps) {
  const limits = GDS_TDS_LIMITS[input.creditTier]

  const items = [
    {
      id: 'stress-test',
      title: 'How the mortgage stress test works',
      content: (
        <div className="space-y-2">
          <p>
            Federal rules require you to qualify at the higher of your contract rate plus{' '}
            {(STRESS_TEST.buffer * 100).toFixed(2)}%, or a floor rate of {(STRESS_TEST.floorRate * 100).toFixed(2)}%.
          </p>
          <p>
            Your contract rate is {(input.contractRate * 100).toFixed(2)}%, so your qualifying rate is{' '}
            <strong>{(result.qualifyingRate * 100).toFixed(2)}%</strong>. Your actual monthly payment would be based
            on the contract rate — the qualifying rate is only used to test affordability.
          </p>
        </div>
      ),
    },
    {
      id: 'gds-tds',
      title: 'GDS / TDS ratio math',
      content: limits ? (
        <div className="space-y-2">
          <p>
            With a {input.creditTier} credit profile, lenders typically cap your Gross Debt Service (GDS) ratio at{' '}
            {(limits.gds * 100).toFixed(0)}% and your Total Debt Service (TDS) ratio at {(limits.tds * 100).toFixed(0)}%
            of gross monthly income.
          </p>
          <p>
            At the maximum affordable price, your GDS ratio is <strong>{(result.gdsRatio * 100).toFixed(1)}%</strong> and
            your TDS ratio is <strong>{(result.tdsRatio * 100).toFixed(1)}%</strong>.
          </p>
        </div>
      ) : (
        <p>Standard GDS/TDS guidelines do not apply to this credit profile.</p>
      ),
    },
    {
      id: 'down-payment',
      title: 'Minimum down payment breakdown',
      content: (
        <div className="space-y-1">
          {result.minDownPaymentRequired.tierBreakdown.map((tier, i) => (
            <p key={i}>
              {formatPrice(tier.portion)} at {(tier.rate * 100).toFixed(0)}% = {formatPrice(tier.amount)}
            </p>
          ))}
          <p className="pt-1 font-medium text-charcoal-900">
            Total: {formatPrice(result.minDownPaymentRequired.minDownPayment)}
          </p>
        </div>
      ),
    },
    {
      id: 'closing-costs',
      title: 'Land transfer tax & closing cost notes',
      content: (
        <div className="space-y-2">
          <p>
            Estimated provincial tax: {formatPrice(result.landTransferTax.provincialTax)}
            {result.landTransferTax.municipalTax > 0 && ` + municipal tax: ${formatPrice(result.landTransferTax.municipalTax)}`}
            {result.landTransferTax.rebates > 0 && ` − rebate: ${formatPrice(result.landTransferTax.rebates)}`}
          </p>
          <ul className="list-disc pl-5 space-y-1">
            {result.landTransferTax.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      ),
    },
  ]

  return <Accordion items={items} />
}
