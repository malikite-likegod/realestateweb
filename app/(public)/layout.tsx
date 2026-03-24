import { Navbar } from '@/components/navigation'
import { Footer } from '@/components/navigation'

// All public pages query the DB at render time — disable static prerendering
// so the build never tries to fetch data before the DB is set up.
export const dynamic = 'force-dynamic'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  )
}
