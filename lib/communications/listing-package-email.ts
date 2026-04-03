import { prisma } from '@/lib/prisma'

interface SendPackageEmailInput {
  pkg: {
    id:         string
    title:      string
    message:    string | null
    magicToken: string
    items: Array<{
      id:         string
      listingKey: string
      property?: {
        streetNumber:          string | null
        streetDirPrefix:       string | null
        streetName:            string | null
        streetSuffix:          string | null
        streetDirSuffix:       string | null
        unitNumber:            string | null
        city:                  string | null
        listPrice:             number | null
        bedroomsTotal:         number | null
        bathroomsTotalInteger: number | null
        livingArea:            number | null
        media:                 string | null
      } | null
    }>
  }
  contact: {
    id:          string
    firstName:   string | null
    lastName:    string | null
    email:       string | null
    emailOptOut: boolean
  }
}

function getFirstPhoto(mediaJson: string | null): string {
  try { return (JSON.parse(mediaJson ?? '[]') as { MediaURL?: string }[])[0]?.MediaURL ?? '' }
  catch { return '' }
}

function formatPrice(price: number | null): string {
  if (!price) return 'Price on request'
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(price)
}

function buildListingCard(
  item: SendPackageEmailInput['pkg']['items'][0],
  baseUrl: string,
  token:   string
): string {
  const p       = item.property
  const photo   = p ? getFirstPhoto(p.media) : ''
  const addressParts = [p?.streetNumber, p?.streetDirPrefix, p?.streetName, p?.streetSuffix, p?.streetDirSuffix, p?.unitNumber ? `#${p.unitNumber}` : null].filter(Boolean)
  const address = addressParts.length > 0 ? addressParts.join(' ') : 'Address unavailable'
  const city    = p?.city ?? ''
  const price   = formatPrice(p?.listPrice ?? null)
  const beds    = p?.bedroomsTotal ?? '—'
  const baths   = p?.bathroomsTotalInteger ?? '—'
  const sqft    = p?.livingArea ? `${p.livingArea.toLocaleString()} sqft` : ''
  const link    = `${baseUrl}/portal/packages/${token}?open=${item.listingKey}`

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;overflow:hidden;">
      <tr>
        ${photo ? `<td width="180" style="vertical-align:top;"><img src="${photo}" width="180" height="120" alt="" style="display:block;object-fit:cover;" /></td>` : ''}
        <td style="padding:16px;vertical-align:top;">
          <p style="margin:0 0 4px;font-weight:600;font-size:15px;color:#111827;">${address}${city ? `, ${city}` : ''}</p>
          <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#92763a;">${price}</p>
          <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">${beds} bed · ${baths} bath${sqft ? ` · ${sqft}` : ''}</p>
          <a href="${link}" style="display:inline-block;padding:8px 16px;background:#92763a;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">View Listing</a>
        </td>
      </tr>
    </table>`
}

export async function sendListingPackageEmail({ pkg, contact }: SendPackageEmailInput): Promise<void> {
  if (!contact.email)      throw new Error('Contact has no email address')
  if (contact.emailOptOut) throw new Error('Contact has opted out of email')

  const baseUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const portalLink = `${baseUrl}/portal/packages/${pkg.magicToken}`
  const firstName  = contact.firstName ?? 'there'

  const listingKeys    = pkg.items.map(i => i.listingKey)
  const properties     = await prisma.resoProperty.findMany({
    where: { listingKey: { in: listingKeys } },
    select: {
      listingKey: true,
      streetNumber: true, streetDirPrefix: true, streetName: true, streetSuffix: true, streetDirSuffix: true, unitNumber: true,
      city: true, listPrice: true, bedroomsTotal: true, bathroomsTotalInteger: true,
      livingArea: true, media: true,
    },
  })
  const propMap        = Object.fromEntries(properties.map(p => [p.listingKey, {
    streetNumber: p.streetNumber, streetDirPrefix: p.streetDirPrefix, streetName: p.streetName, streetSuffix: p.streetSuffix, streetDirSuffix: p.streetDirSuffix, unitNumber: p.unitNumber,
    city: p.city, listPrice: p.listPrice, bedroomsTotal: p.bedroomsTotal,
    bathroomsTotalInteger: p.bathroomsTotalInteger, livingArea: p.livingArea, media: p.media,
  }]))
  const itemsWithProps = pkg.items.map(i => ({ ...i, property: i.property ?? propMap[i.listingKey] ?? null }))
  const listingCards   = itemsWithProps.map(item => buildListingCard(item, baseUrl, pkg.magicToken)).join('')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <tr><td style="background:#111827;padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:700;">Michael Taylor Realty</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:16px;color:#111827;">Hi ${firstName},</p>
          ${pkg.message ? `<p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">${pkg.message}</p>` : ''}
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr><td align="center" style="background:#f3f4f6;border-radius:8px;padding:20px;">
              <p style="margin:0 0 12px;font-size:15px;color:#374151;font-weight:500;">I've selected ${itemsWithProps.length} listing${itemsWithProps.length !== 1 ? 's' : ''} for you</p>
              <a href="${portalLink}" style="display:inline-block;padding:12px 28px;background:#92763a;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:700;">View All ${itemsWithProps.length} Listings in Your Portal →</a>
            </td></tr>
          </table>
          ${listingCards}
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">You are receiving this because your agent shared listings with you.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const nodemailer  = (await import('nodemailer')).default
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })

  await transporter.sendMail({
    from:    process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to:      contact.email,
    subject: pkg.title,
    html,
  })
}
