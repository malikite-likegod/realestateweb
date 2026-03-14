'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AccordionItem {
  id: string
  title: string
  content: React.ReactNode
}

interface AccordionProps {
  items: AccordionItem[]
  className?: string
}

export function Accordion({ items, className }: AccordionProps) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className={cn('divide-y divide-charcoal-100 rounded-xl border border-charcoal-200', className)}>
      {items.map(item => (
        <div key={item.id}>
          <button
            onClick={() => setOpen(open === item.id ? null : item.id)}
            className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-charcoal-900 hover:bg-charcoal-50 transition-colors"
          >
            {item.title}
            <motion.div animate={{ rotate: open === item.id ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={16} className="text-charcoal-400" />
            </motion.div>
          </button>
          <AnimatePresence initial={false}>
            {open === item.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-4 text-sm text-charcoal-600">{item.content}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}
