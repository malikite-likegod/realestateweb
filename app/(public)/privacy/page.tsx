import { Container, Section } from '@/components/layout'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | Michael Taylor Real Estate',
  description: 'Privacy Policy for Michael Taylor Real Estate Services.',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="pt-20">
      <Section background="light" padding="md">
        <Container size="md">
          <h1 className="font-serif text-4xl font-bold text-charcoal-900">Privacy Policy</h1>
          <p className="mt-2 text-sm text-charcoal-500">Effective Date: January 1st, 2026</p>
        </Container>
      </Section>

      <Section>
        <Container size="md">
          <div className="prose prose-charcoal max-w-none prose-headings:font-serif prose-a:text-gold-600">

            <p>
              Michael Taylor Real Estate Services (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) respects your privacy and is committed to
              protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and
              safeguard your information when you visit our website michaeltaylorrealty.com (the &ldquo;Site&rdquo;), use our
              services, or interact with us. By accessing or using the Site, you agree to the practices described in
              this policy.
            </p>

            <h2>1. Information We Collect</h2>
            <p>We may collect the following types of information:</p>
            <ul>
              <li>
                <strong>Personal Information:</strong> Name, email address, phone number, mailing address, and other
                contact details you provide when filling out contact forms, requesting property information,
                scheduling showings, subscribing to newsletters, or creating an account.
              </li>
              <li>
                <strong>MLS/IDX Listing-Related Data:</strong> When you search or view listings, we may collect search
                criteria, viewed properties, saved searches, or inquiries. This helps us assist you better. MLS
                listing data itself (property details) comes from your local MLS system and is governed by MLS rules.
              </li>
              <li>
                <strong>Automatically Collected Information:</strong> IP address, browser type, device information,
                pages visited, time spent on pages, and referral sources via cookies, web beacons, or analytics tools
                (e.g., Google Analytics).
              </li>
              <li>
                <strong>Cookies and Tracking:</strong> We use essential cookies for site functionality, analytics
                cookies for performance, and advertising cookies for targeted real estate ads. You can manage cookie
                preferences through your browser settings.
              </li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul>
              <li>Provide real estate services, respond to inquiries, and facilitate property searches or showings.</li>
              <li>Improve our Site, personalize your experience, and analyze usage trends.</li>
              <li>
                Send marketing communications (e.g., new listings, market updates) if you opt in. You may
                unsubscribe at any time.
              </li>
              <li>Comply with legal obligations, enforce our Terms of Service, and protect our rights.</li>
              <li>Share aggregated or anonymized data for industry insights (without identifying you).</li>
            </ul>
            <p>
              We do not sell your personal information. Lead data from the Site (e.g., contact forms) is used
              internally or shared only with trusted partners as needed for service delivery.
            </p>

            <h2>3. Sharing Your Information</h2>
            <p>We may share information with:</p>
            <ul>
              <li>
                <strong>Service Providers:</strong> Hosting, analytics, email marketing, or CRM providers who assist
                our operations (bound by confidentiality).
              </li>
              <li>
                <strong>MLS and Real Estate Partners:</strong> As required for IDX compliance, to display accurate
                listings or process transactions.
              </li>
              <li>
                <strong>Legal Requirements:</strong> When required by law, court order, or to protect safety and
                rights.
              </li>
              <li>
                <strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets.
              </li>
            </ul>
            <p>
              We do not share data with third parties for their independent marketing purposes without your consent.
            </p>

            <h2>4. Data Security</h2>
            <p>
              We implement reasonable administrative, technical, and physical safeguards (e.g., SSL encryption) to
              protect your information. However, no system is completely secure, and we cannot guarantee absolute
              security.
            </p>

            <h2>5. Your Rights and Choices</h2>
            <p>
              Depending on your location (e.g., California residents under CCPA), you may have rights to:
            </p>
            <ul>
              <li>Access, correct, or delete your personal information.</li>
              <li>Opt out of the sale of personal information (we do not sell it).</li>
              <li>Limit the use of sensitive personal information.</li>
            </ul>
            <p>
              To exercise these rights, contact us at{' '}
              <a href="mailto:miketaylor.realty@gmail.com">miketaylor.realty@gmail.com</a> or{' '}
              <a href="tel:+14168888352">416-888-8352</a>. We will respond within required timelines. You can also
              manage marketing preferences via unsubscribe links.
            </p>

            <h2>6. Children&apos;s Privacy</h2>
            <p>
              Our Site is not intended for children under 13 (or 16 in some jurisdictions). We do not knowingly
              collect data from children.
            </p>

            <h2>7. International Users</h2>
            <p>
              If you access the Site from outside the U.S., your data may be transferred to and processed in the
              U.S. By using the Site, you consent to this transfer.
            </p>

            <h2>8. Changes to This Privacy Policy</h2>
            <p>
              We may update this policy periodically. We will notify you of material changes by posting the updated
              policy on the Site with a new effective date. Continued use constitutes acceptance.
            </p>

            <h2>9. Contact Us</h2>
            <p>For questions about this Privacy Policy, contact:</p>
            <address className="not-italic">
              <strong>Michael Taylor</strong><br />
              245 West Beaver Creek Unit 9B<br />
              Richmond Hill, ON&nbsp; L4B 1L1<br />
              <a href="mailto:miketaylor.realty@gmail.com">miketaylor.realty@gmail.com</a><br />
              <a href="tel:+14168888352">416-888-8352</a>
            </address>

            <hr />

            <p className="text-xs text-charcoal-500">
              The trademarks MLS®, Multiple Listing Service® and the associated logos are owned by The Canadian Real
              Estate Association (CREA) and identify the quality of services provided by real estate professionals
              who are members of CREA. The trademarks REALTOR®, REALTORS®, and the REALTOR® logo are controlled by
              CREA and identify real estate professionals who are members of CREA. Data is deemed reliable but not
              guaranteed accurate by PROPTX. Displayed on an IDX-approved website.
            </p>

          </div>
        </Container>
      </Section>
    </div>
  )
}
