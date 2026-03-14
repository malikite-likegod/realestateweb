import { cn } from '@/lib/utils'
import Image from 'next/image'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const sizes: Record<AvatarSize, { container: string; text: string }> = {
  xs: { container: 'h-6 w-6 text-xs', text: 'text-[10px]' },
  sm: { container: 'h-8 w-8 text-sm', text: 'text-xs' },
  md: { container: 'h-10 w-10 text-base', text: 'text-sm' },
  lg: { container: 'h-12 w-12 text-lg', text: 'text-base' },
  xl: { container: 'h-16 w-16 text-xl', text: 'text-lg' },
}

interface AvatarProps {
  src?: string | null
  name?: string
  size?: AvatarSize
  className?: string
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

export function Avatar({ src, name = '?', size = 'md', className }: AvatarProps) {
  const { container } = sizes[size]
  return (
    <div className={cn('relative flex shrink-0 overflow-hidden rounded-full bg-charcoal-200', container, className)}>
      {src ? (
        <Image src={src} alt={name} fill className="object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-medium text-charcoal-600 text-xs">
          {getInitials(name)}
        </span>
      )}
    </div>
  )
}
