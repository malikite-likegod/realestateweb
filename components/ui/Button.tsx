'use client'

import React, { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'gold' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
  asChild?: boolean
}

const variants: Record<ButtonVariant, string> = {
  primary:   'bg-charcoal-900 text-white hover:bg-charcoal-700 focus-visible:ring-charcoal-900',
  secondary: 'bg-charcoal-100 text-charcoal-900 hover:bg-charcoal-200 focus-visible:ring-charcoal-400',
  outline:   'border border-charcoal-900 text-charcoal-900 hover:bg-charcoal-50 focus-visible:ring-charcoal-900',
  ghost:     'text-charcoal-700 hover:bg-charcoal-100 focus-visible:ring-charcoal-400',
  gold:      'bg-gold-500 text-white hover:bg-gold-600 focus-visible:ring-gold-500',
  danger:    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  xl: 'h-14 px-8 text-lg gap-2.5',
}

const baseClass = (variant: ButtonVariant, size: ButtonSize, fullWidth?: boolean, className?: string) =>
  cn(
    'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    fullWidth && 'w-full',
    className,
  )

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, leftIcon, rightIcon, fullWidth, className, children, disabled, asChild, ...props }, ref) => {
    // When asChild, render children clone with button classes applied
    if (asChild && children) {
      const child = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>
      return (
        <motion.div whileTap={{ scale: 0.97 }} className="inline-flex">
          {React.cloneElement(child, {
            className: cn(baseClass(variant, size, fullWidth, className), child.props.className),
          })}
        </motion.div>
      )
    }

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        className={baseClass(variant, size, fullWidth, className)}
        disabled={disabled || loading}
        {...(props as React.ComponentProps<typeof motion.button>)}
      >
        {loading ? <Loader2 className="animate-spin" size={16} /> : leftIcon}
        {children}
        {!loading && rightIcon}
      </motion.button>
    )
  }
)
Button.displayName = 'Button'
