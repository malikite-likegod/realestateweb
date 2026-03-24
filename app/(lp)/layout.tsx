export const dynamic = 'force-dynamic'

// Landing page route group — no Navbar or Footer
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
