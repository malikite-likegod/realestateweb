import { Container, Section, PageHeader } from '@/components/layout'
import { ToolsGrid } from '@/components/tools'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Real Estate Tools',
  description: 'Free tools to help you plan your next move, including a mortgage affordability and stress test calculator.',
}

export default function ToolsHubPage() {
  return (
    <div className="pt-20">
      <Section padding="lg">
        <Container>
          <PageHeader
            title="Real Estate Tools"
            subtitle="Free tools to help you plan your next move — starting with a mortgage affordability calculator, with more on the way."
          />
          <ToolsGrid />
        </Container>
      </Section>
    </div>
  )
}
