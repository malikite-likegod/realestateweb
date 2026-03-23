export function MlsDisclaimer({ variant }: { variant: 'idx' | 'vow' }) {
  const variantText = variant === 'idx'
    ? 'Displayed on an IDX-approved website.'
    : 'Displayed in a VOW-compliant authenticated area. Access restricted to genuine consumers.'

  return (
    <footer
      role="contentinfo"
      aria-label="MLS Data Disclaimer"
      className="mt-8 border-t border-charcoal-100 pt-4 text-xs text-charcoal-400 leading-relaxed"
    >
      <p>
        The trademarks MLS®, Multiple Listing Service® and the associated logos are owned by The Canadian
        Real Estate Association (CREA) and identify the quality of services provided by real estate
        professionals who are members of CREA. The trademarks REALTOR®, REALTORS®, and the REALTOR® logo
        are controlled by CREA and identify real estate professionals who are members of CREA. Data is
        deemed reliable but not guaranteed accurate by PROPTX.{' '}
        <span>{variantText}</span>
      </p>
    </footer>
  )
}
