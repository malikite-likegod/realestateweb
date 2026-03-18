import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/layout'
import { Section } from '@/components/layout'
import { ContentBlock } from '@/components/layout'
import { Button } from '@/components/ui'

export const metadata: Metadata = {
  title: 'About Mike Taylor',
  description: 'My journey from job uncertainty to real estate — a personal story about resilience, purpose, and finding fulfillment.',
}

const chapters = [
  {
    period: '2006 – 2008',
    heading: 'When the Ground Shifted',
    body: `Between 2006 and 2008, leading up to the financial crisis and during it, my job situation got pretty crazy. I had to switch jobs a bunch of times because things were changing so fast in the job market. It felt like the days of having a secure job were disappearing — the kind of job where you work hard and your boss treats you well. But that seemed like something from the past.

Even with all the uncertainty, I knew I still wanted to help people. Unfortunately, this troubling theme would continue down the road, where I would be working at jobs where being unappreciated was just how things went.`,
  },
  {
    period: '2013 – 2014',
    heading: 'Loss and a New Lens',
    body: `In 2013 I took a job in the public sector, and like before, it didn't turn out like I hoped. Instead of feeling good about my work, I felt unhappy and mistreated. Even though I knew the job wasn't right for me in the long run, I stuck with it.

A year later I would lose my mother to cancer. After this devastating loss I would start to think about what was important in my life and the further need to start prioritizing health and work-life balance. As time went on I had to deal with a lot of unfair treatment from my boss and a work environment that cared more about politics than helping people.`,
  },
  {
    period: 'The Turning Point',
    heading: 'Enough Was Enough',
    body: `Things got even worse when I got sick and needed time off. Instead of being understanding, my boss refused to support me in my time of need. That was the moment I realized I couldn't keep wasting my time in a job that made me miserable, even if it seemed safe. I decided to leave and find something that would let me make a real difference and feel fulfilled.`,
  },
  {
    period: 'The Spark',
    heading: 'A Light Bulb Moment',
    body: `When I first started reading "Rich Dad Poor Dad," it felt like a light bulb turning on in my head. The author's story about going from thinking in the usual way to finding freedom with money and happiness really spoke to me. I was tired of feeling stuck in a job that didn't make me happy. So I decided to take a big leap and follow the advice from the book.

I saw real estate as a way to grow and find new opportunities, but I was scared to fully commit because I was afraid of not being stable. But I decided to push past that fear and dive into real estate with all my heart — not just to do well financially, but also to feel truly fulfilled in what I was doing.`,
  },
  {
    period: 'Looking Back',
    heading: 'Challenges as Lessons',
    body: `There were times when I felt like my skills weren't being appreciated, and it seemed like my hard work was being ignored. But looking back, I realize those tough experiences weren't for nothing. They were like tests that helped me learn and grow. Each challenge taught me how to be stronger and smarter.

Those experiences are what drive me to show up fully for every client I work with — because I know what it feels like to need someone in your corner.`,
  },
]

export default function AboutPage() {
  return (
    <div className="pt-20">

      {/* Hero */}
      <Section background="light" padding="md">
        <Container size="sm">
          <ContentBlock
            eyebrow="About Mike Taylor"
            title="My Story"
            body="Real estate wasn't just a career move — it was the result of years of searching for work that truly mattered. Here's how I got here."
            centered
          />
        </Container>
      </Section>

      {/* Story chapters */}
      <Section>
        <Container size="sm">
          <div className="flex flex-col divide-y divide-charcoal-100">
            {chapters.map(({ period, heading, body }) => (
              <div key={period} className="py-12 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 md:gap-12">
                <div className="shrink-0">
                  <span className="inline-block text-xs font-semibold uppercase tracking-widest text-gold-600 bg-gold-50 rounded-full px-3 py-1">
                    {period}
                  </span>
                </div>
                <div>
                  <h3 className="font-serif text-2xl font-bold text-charcoal-900 mb-4">{heading}</h3>
                  {body.split('\n\n').map((paragraph, i) => (
                    <p key={i} className="text-charcoal-600 leading-relaxed mb-4 last:mb-0">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* CTA */}
      <Section background="charcoal">
        <Container size="sm">
          <ContentBlock
            eyebrow="Let's Connect"
            title="Ready to Work Together?"
            body="I bring the same determination that carried me through hard times to every client relationship. If you're ready to buy, sell, or just explore your options, I'd love to hear from you."
            centered
            light
          >
            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <Button variant="gold" size="lg" asChild>
                <Link href="/contact">Get in Touch</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/listings">Browse Listings</Link>
              </Button>
            </div>
          </ContentBlock>
        </Container>
      </Section>

    </div>
  )
}
