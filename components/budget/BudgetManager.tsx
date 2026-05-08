'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { BudgetTab } from './BudgetTab'
import { TransactionsTab } from './TransactionsTab'
import { ReportsTab } from './ReportsTab'

type Tab = 'budget' | 'transactions' | 'reports'

export function BudgetManager() {
  const [tab, setTab] = useState<Tab>('budget')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 border-b border-charcoal-800">
        {(['budget', 'transactions', 'reports'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors',
              tab === t
                ? 'border-gold-400 text-gold-400'
                : 'border-transparent text-charcoal-400 hover:text-white',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'budget'       && <BudgetTab />}
      {tab === 'transactions' && <TransactionsTab />}
      {tab === 'reports'      && <ReportsTab />}
    </div>
  )
}
