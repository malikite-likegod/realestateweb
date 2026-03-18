interface VerificationEmailOpts {
  to:        string
  firstName: string
  token:     string
  returnUrl: string
}

export async function sendVerificationEmail(opts: VerificationEmailOpts) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  // Uses /api/gate/verify (Route Handler) so the handler can set cookies + redirect.
  // Page Server Components cannot write cookies in Next.js 15.
  const link    = `${baseUrl}/api/gate/verify?token=${encodeURIComponent(opts.token)}`

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="font-size:22px;font-weight:700;color:#111;margin:0 0 8px">Hi ${opts.firstName},</h2>
      <p style="color:#555;margin:0 0 24px">Click the button below to verify your email and browse listings freely.</p>
      <a href="${link}" style="display:inline-block;background:#d4a843;color:#fff;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none">Confirm Email &amp; Browse Listings</a>
      <p style="color:#888;font-size:12px;margin:24px 0 0">Link expires in 24 hours. If you didn't request this, you can ignore this email.</p>
    </div>
  `

  if (!process.env.SMTP_HOST) {
    console.log(`[gate-email] SMTP not configured — verification link: ${link}`)
    return
  }

  const { default: nodemailer } = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  await transporter.sendMail({
    from:    process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@example.com',
    to:      opts.to,
    subject: 'Confirm your email to browse listings',
    html,
  })
}
