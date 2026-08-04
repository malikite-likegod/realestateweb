'use client'

import { useMemo, useState } from 'react'
import { Tabs, Badge } from '@/components/ui'
import { formatPrice } from '@/lib/utils'
import { DEFAULT_ASSUMPTIONS, calculateMaxAffordability, checkStressTestPass } from '@/lib/mortgage'
import type { AffordabilityInput, CreditTier, Province } from '@/lib/mortgage'
import { IncomeDebtsFields } from './affordability/IncomeDebtsFields'
import { PropertyDownPaymentFields } from './affordability/PropertyDownPaymentFields'
import { ResultsPanel } from './affordability/ResultsPanel'
import { CalculationBreakdownAccordion } from './affordability/CalculationBreakdownAccordion'
import { CheckCircle2, XCircle } from 'lucide-react'

interface AffordabilityCalculatorProps {
  initialPrice?: number
  /** Current rate (decimal, e.g. 0.0499), sourced from Settings → Mortgage Calculator. Falls back to a static default if unset. */
  initialRate?: number
}

export function AffordabilityCalculator({ initialPrice, initialRate }: AffordabilityCalculatorProps) {
  const [province, setProvince] = useState<Province>('ON')
  const [grossAnnualIncome, setGrossAnnualIncome] = useState(100_000)
  const [monthlyDebts, setMonthlyDebts] = useState(300)
  const [creditTier, setCreditTier] = useState<CreditTier>('good')
  const [isFirstTimeBuyer, setIsFirstTimeBuyer] = useState(false)

  const [purchasePriceOverride, setPurchasePriceOverride] = useState<number | undefined>(initialPrice)
  const [downPayment, setDownPayment] = useState(50_000)
  const [contractRatePercent, setContractRatePercent] = useState((initialRate ?? DEFAULT_ASSUMPTIONS.contractRate) * 100)
  const [amortizationYears, setAmortizationYears] = useState(DEFAULT_ASSUMPTIONS.amortizationYears)
  const [propertyTaxAnnual, setPropertyTaxAnnual] = useState(0)
  const [condoFeesMonthly, setCondoFeesMonthly] = useState(0)
  const [heatMonthly, setHeatMonthly] = useState(0)
  const [isTorontoProperty, setIsTorontoProperty] = useState(false)

  const input: AffordabilityInput = useMemo(
    () => ({
      province,
      grossAnnualIncome,
      monthlyDebts,
      downPayment,
      creditTier,
      contractRate: contractRatePercent / 100,
      amortizationYears,
      propertyTaxAnnual,
      condoFeesMonthly,
      heatMonthly,
      isFirstTimeBuyer,
      isTorontoProperty: province === 'ON' && isTorontoProperty,
    }),
    [province, grossAnnualIncome, monthlyDebts, downPayment, creditTier, contractRatePercent, amortizationYears, propertyTaxAnnual, condoFeesMonthly, heatMonthly, isFirstTimeBuyer, isTorontoProperty]
  )

  const result = useMemo(() => calculateMaxAffordability(input), [input])

  const purchasePrice = purchasePriceOverride ?? result.maxPurchasePrice

  const targetPriceCheck = useMemo(
    () => (purchasePrice > 0 ? checkStressTestPass(input, purchasePrice) : null),
    [input, purchasePrice]
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-2">
        {targetPriceCheck && (
          <div className="mb-6 rounded-2xl border border-charcoal-100 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              {targetPriceCheck.passes ? (
                <Badge variant="success"><span className="inline-flex items-center gap-1"><CheckCircle2 size={12} /> Likely qualifies</span></Badge>
              ) : (
                <Badge variant="warning"><span className="inline-flex items-center gap-1"><XCircle size={12} /> May not qualify yet</span></Badge>
              )}
              <span className="text-sm text-charcoal-600">for {formatPrice(purchasePrice)}, based on the figures below</span>
            </div>
            {targetPriceCheck.suggestions.length > 0 && (
              <ul className="list-disc pl-5 space-y-1 text-sm text-charcoal-600">
                {targetPriceCheck.suggestions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
          </div>
        )}

        <Tabs
          tabs={[
            {
              id: 'finances',
              label: 'Your Finances',
              content: (
                <IncomeDebtsFields
                  province={province}
                  onProvinceChange={setProvince}
                  grossAnnualIncome={grossAnnualIncome}
                  onGrossAnnualIncomeChange={setGrossAnnualIncome}
                  monthlyDebts={monthlyDebts}
                  onMonthlyDebtsChange={setMonthlyDebts}
                  creditTier={creditTier}
                  onCreditTierChange={setCreditTier}
                  isFirstTimeBuyer={isFirstTimeBuyer}
                  onIsFirstTimeBuyerChange={setIsFirstTimeBuyer}
                />
              ),
            },
            {
              id: 'property',
              label: 'Property & Down Payment',
              content: (
                <PropertyDownPaymentFields
                  purchasePrice={purchasePrice}
                  onPurchasePriceChange={setPurchasePriceOverride}
                  isPurchasePriceOverridden={purchasePriceOverride != null}
                  onResetPurchasePrice={() => setPurchasePriceOverride(undefined)}
                  downPayment={downPayment}
                  onDownPaymentChange={setDownPayment}
                  contractRatePercent={contractRatePercent}
                  onContractRatePercentChange={setContractRatePercent}
                  amortizationYears={amortizationYears}
                  onAmortizationYearsChange={setAmortizationYears}
                  propertyTaxAnnual={propertyTaxAnnual}
                  onPropertyTaxAnnualChange={setPropertyTaxAnnual}
                  condoFeesMonthly={condoFeesMonthly}
                  onCondoFeesMonthlyChange={setCondoFeesMonthly}
                  heatMonthly={heatMonthly}
                  onHeatMonthlyChange={setHeatMonthly}
                  showTorontoOption={province === 'ON'}
                  isTorontoProperty={isTorontoProperty}
                  onIsTorontoPropertyChange={setIsTorontoProperty}
                />
              ),
            },
          ]}
        />

        <div className="mt-8">
          <h3 className="font-serif text-lg font-bold text-charcoal-900 mb-3">How We Calculated This</h3>
          <CalculationBreakdownAccordion input={input} result={result} />
        </div>
      </div>

      <div className="lg:sticky lg:top-24">
        <ResultsPanel input={input} result={result} />
      </div>
    </div>
  )
}
