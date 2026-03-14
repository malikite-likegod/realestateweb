import { cn } from '@/lib/utils'

interface SectionProps {
  children: React.ReactNode
  className?: string
  id?: string
  background?: 'white' | 'light' | 'dark' | 'charcoal'
  padding?: 'sm' | 'md' | 'lg' | 'xl'
}

const backgrounds = {
  white:    'bg-white',
  light:    'bg-charcoal-50',
  dark:     'bg-charcoal-900 text-white',
  charcoal: 'bg-charcoal-950 text-white',
}

const paddings = {
  sm: 'py-8',
  md: 'py-16',
  lg: 'py-24',
  xl: 'py-32',
}

export function Section({ children, className, id, background = 'white', padding = 'lg' }: SectionProps) {
  return (
    <section id={id} className={cn(backgrounds[background], paddings[padding], className)}>
      {children}
    </section>
  )
}
