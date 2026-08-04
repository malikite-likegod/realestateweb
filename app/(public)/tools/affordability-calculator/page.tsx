import { Container, Section, PageHeader } from '@/components/layout'
import { AffordabilityCalculator } from '@/components/tools'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Affordability & Approval Calculator',
  description: 'Estimate what you could qualify for, including the mortgage stress test, minimum down payment, CMHC insurance, and closing costs for your province.',
}

interface Props {
  searchParams: Promise<{ price?: string }>
}

export default async function AffordabilityCalculatorPage({ searchParams }: Props) {
  const { price } = await searchParams
  const initialPrice = price ? Number(price) : undefined

  return (
    <div className="pt-20">
      <Section padding="lg">
        <Container size="xl">
          <PageHeader
            title="Affordability & Approval Calculator"
            subtitle="Enter your finances to see what you could qualify for, including the mortgage stress test, minimum down payment, and estimated closing costs."
            breadcrumbs={[{ label: 'Tools', href: '/tools' }, { label: 'Affordability Calculator' }]}
          />
          <AffordabilityCalculator initialPrice={initialPrice && Number.isFinite(initialPrice) ? initialPrice : undefined} />
        </Container>
      </Section>
    </div>
  )
}
