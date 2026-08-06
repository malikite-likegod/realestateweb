import { Container, Section, PageHeader } from '@/components/layout'
import { RentVsBuyCalculator } from '@/components/tools'
import { getMortgageRate } from '@/lib/site-settings'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Rent vs. Buy Comparison',
  description: "Compare your current monthly rent against the estimated cost of buying a home near you at a similar monthly payment.",
}

export default async function RentVsBuyPage() {
  const initialRate = await getMortgageRate()

  return (
    <div className="pt-20">
      <Section padding="lg">
        <Container size="xl">
          <PageHeader
            title="Rent vs. Buy Comparison"
            subtitle="See what buying could look like at the monthly cost you're already paying to rent."
            breadcrumbs={[{ label: 'Tools', href: '/tools' }, { label: 'Rent vs. Buy Comparison' }]}
          />
          <RentVsBuyCalculator initialRate={initialRate} />
        </Container>
      </Section>
    </div>
  )
}
