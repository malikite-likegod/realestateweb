import { Container, Section } from '@/components/layout'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service | Michael Taylor Real Estate',
  description: 'Terms of Service for michaeltaylorrealty.com operated by Michael Taylor Real Estate Services.',
}

export default function TermsOfServicePage() {
  return (
    <div className="pt-20">
      <Section background="light" padding="md">
        <Container size="md">
          <h1 className="font-serif text-4xl font-bold text-charcoal-900">Terms of Service</h1>
          <p className="mt-2 text-sm text-charcoal-500">Effective Date: January 1st, 2026</p>
        </Container>
      </Section>

      <Section>
        <Container size="md">
          <div className="prose prose-charcoal max-w-none prose-headings:font-serif prose-a:text-gold-600">

            <p>
              Welcome to michaeltaylorrealty.com (the &ldquo;Site&rdquo;), operated by Michael Taylor Real Estate
              Services (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). These Terms of Service
              (&ldquo;Terms&rdquo;) govern your access to and use of the Site, including MLS/IDX property listings.
              By accessing or using the Site, you agree to these Terms. If you do not agree, do not use the Site.
            </p>

            <h2>1. Use of the Site</h2>
            <p>
              The Site provides information about real estate listings, market data, and services for informational
              purposes. You may use the Site for personal, non-commercial purposes to search for properties you may
              be interested in purchasing or selling.
            </p>
            <ul>
              <li>
                <strong>MLS/IDX Listings:</strong> Listings are sourced from PropTx via authorized IDX feeds.
                Information is deemed reliable but not guaranteed. We do not warrant the accuracy, completeness, or
                timeliness of listings. Verify all details independently with the listing agent or through official
                records.
              </li>
              <li>
                <strong>Restrictions:</strong> You may not: copy, scrape, redistribute, or commercially use listing
                data; use the Site for any unlawful purpose; interfere with Site operations; or bypass security
                measures. All MLS data remains the property of the respective MLS and is protected by copyright.
              </li>
            </ul>

            <h2>2. User Accounts and Communications</h2>
            <p>
              If you create an account or submit information (e.g., contact forms), you agree to provide accurate
              details and keep them updated. You are responsible for all activity under your account. We may send you
              service-related or marketing emails; you can opt out of marketing at any time.
            </p>

            <h2>3. Intellectual Property</h2>
            <p>
              All content on the Site (text, images, logos, listings) is owned by us, our licensors, or MLS
              participants and protected by copyright, trademark, and other laws. You are granted a limited,
              revocable license to view content for personal use only. IDX displays must include required
              attributions (e.g., listing broker name, MLS source, &ldquo;Information Deemed Reliable But Not
              Guaranteed&rdquo;).
            </p>

            <h2>4. Disclaimers and No Warranties</h2>
            <p>
              The Site and all content are provided &ldquo;AS IS&rdquo; without warranties of any kind. We disclaim
              all warranties, express or implied, including merchantability, fitness for a particular purpose, and
              non-infringement. We are not responsible for third-party sites linked from ours or for any errors in
              listings.
            </p>
            <p>
              Real estate transactions involve risks; professional advice from licensed agents, attorneys,
              inspectors, etc., is recommended.
            </p>

            <h2>5. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages arising from your use of the Site, even if advised of the
              possibility. Our total liability shall not exceed $100.
            </p>

            <h2>6. Indemnification</h2>
            <p>
              You agree to indemnify and hold us harmless from any claims, losses, or damages arising from your
              violation of these Terms or misuse of the Site.
            </p>

            <h2>7. Termination</h2>
            <p>
              We may terminate or suspend your access to the Site at any time, with or without cause. Provisions
              that by nature should survive (e.g., disclaimers, liability) will continue.
            </p>

            <h2>8. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the Province of Ontario, without regard to conflict of laws
              principles. Any disputes shall be resolved exclusively in the courts of Ontario, Canada.
            </p>

            <h2>9. Changes to Terms</h2>
            <p>
              We may update these Terms. Continued use after changes constitutes acceptance. Check this page
              periodically.
            </p>

            <h2>10. Contact Us</h2>
            <p>For questions, contact:</p>
            <address className="not-italic">
              <strong>Michael Taylor</strong><br />
              245 West Beaver Creek Unit 9B<br />
              Richmond Hill, ON&nbsp; L4B 1L1<br />
              <a href="mailto:miketaylor.realty@gmail.com">miketaylor.realty@gmail.com</a><br />
              <a href="tel:+14168888352">416-888-8352</a>
            </address>

            <hr />

            <p className="text-xs text-charcoal-500">
              <strong>MLS Compliance Note:</strong> Listings displayed are from participating MLS participants. Some
              properties may not appear at the seller&apos;s request. This Site is controlled by Michael Taylor Real
              Estate Services. Information is for consumer personal, non-commercial use only.
            </p>

          </div>
        </Container>
      </Section>
    </div>
  )
}
