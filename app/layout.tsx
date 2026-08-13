import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ui'
import { GoogleAnalytics } from '@/components/analytics'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: "Helping first time home buyers & upsizers transition into a new home.",
  keywords: ['Michael Taylor real estate', 'Toronto', 'buy home', 'sell home', 'realtor'],
  openGraph: {
    type: 'website',
    locale: 'en_CA',
    siteName: APP_NAME,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

  return (
    <html lang="en">
      <body>
        {gaMeasurementId && <GoogleAnalytics measurementId={gaMeasurementId} />}
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
