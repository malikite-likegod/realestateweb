import { cn } from '@/lib/utils'

export function MortgageDisclaimer({ className }: { className?: string }) {
  return (
    <footer
      role="contentinfo"
      aria-label="Mortgage Estimate Disclaimer"
      className={cn('border-t border-charcoal-100 pt-3 text-xs text-charcoal-400 leading-relaxed', className)}
    >
      <p>
        This is an estimate only, based on the figures entered, and is not a mortgage pre-approval,
        pre-qualification, or a guarantee of financing. Actual amounts depend on your full financial
        picture, credit history, and a lender&apos;s underwriting criteria. Your real estate agent is a
        licensed salesperson, not a mortgage broker — confirm your actual borrowing power and payment
        with a licensed mortgage professional before making an offer. Land transfer tax figures are
        approximate and may not reflect municipally-set rates in your area.
      </p>
    </footer>
  )
}
