'use client'

/**
 * MergeTagPicker
 *
 * Renders a row of clickable merge-tag chips. Clicking a chip inserts the
 * tag at the current cursor position inside the referenced textarea.
 *
 * Available tags are replaced at send-time with real contact / agent data
 * by the email-service renderTemplate() function.
 */

import { RefObject } from 'react'

export const MERGE_TAGS = [
  // Contact
  { label: '{{firstName}}',        description: "Contact's first name"  },
  { label: '{{lastName}}',         description: "Contact's last name"   },
  { label: '{{fullName}}',         description: "Contact's full name"   },
  { label: '{{email}}',            description: "Contact's email"       },
  { label: '{{phone}}',            description: "Contact's phone"       },
  // Agent profile
  { label: '{{agentName}}',        description: "Agent's name"                    },
  { label: '{{agentEmail}}',       description: "Agent's email"                   },
  { label: '{{agentPhone}}',       description: "Agent's phone"                   },
  { label: '{{agentDesignation}}', description: "Agent's designation / title"     },
  { label: '{{agentBrokerage}}',   description: "Agent's brokerage name"          },
  { label: '{{officeAddress}}',    description: "Office address"                  },
  { label: '{{agentBio}}',         description: "Agent bio paragraph"             },
  { label: '{{agentImage}}',       description: "Agent photo URL"                 },
  // Date
  { label: '{{MONTH}}',            description: "Current month name (e.g. April)" },
  { label: '{{YEAR}}',             description: "Current four-digit year"          },
]

interface Props {
  textareaRef: RefObject<HTMLTextAreaElement | HTMLInputElement | null>
  value:    string
  onChange: (val: string) => void
}

export function MergeTagPicker({ textareaRef, value, onChange }: Props) {
  function insert(tag: string) {
    const el = textareaRef.current
    if (!el) {
      onChange(value + tag)
      return
    }
    const start = el.selectionStart ?? value.length
    const end   = el.selectionEnd   ?? value.length
    const next  = value.slice(0, start) + tag + value.slice(end)
    onChange(next)
    // Restore focus + cursor position after React re-render
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + tag.length
      el.setSelectionRange(pos, pos)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-charcoal-100 bg-charcoal-50 px-2 py-1.5">
      <span className="text-xs text-charcoal-400 shrink-0 mr-1">Insert:</span>
      {MERGE_TAGS.map(({ label, description }) => (
        <button
          key={label}
          type="button"
          title={description}
          onClick={() => insert(label)}
          className="rounded bg-white border border-charcoal-200 px-1.5 py-0.5 text-xs text-charcoal-600 hover:bg-charcoal-900 hover:text-white hover:border-charcoal-900 transition-colors font-mono"
        >
          {label}
        </button>
      ))}
    </div>
  )
}
