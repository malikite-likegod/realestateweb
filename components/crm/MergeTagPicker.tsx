'use client'

/**
 * MergeTagPicker
 *
 * Renders a row of clickable merge-tag chips. Clicking a chip inserts the
 * tag at the current cursor position inside the referenced textarea.
 *
 * Available tags are replaced at send-time with real contact / agent data
 * by the email-service renderTemplate() function.
 *
 * Listing tags use the syntax {{listing:MLSNUMBER:field}} and are resolved
 * by resolveListingTags() in email-service at send time.
 */

import { useState, RefObject } from 'react'

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

const LISTING_FIELDS: Array<{ field: string; label: string }> = [
  { field: 'address', label: 'Address' },
  { field: 'price',   label: 'Price'   },
  { field: 'image',   label: 'Image'   },
  { field: 'link',    label: 'Link'    },
]

interface Props {
  textareaRef: RefObject<HTMLTextAreaElement | HTMLInputElement | null>
  value:    string
  onChange: (val: string) => void
}

export function MergeTagPicker({ textareaRef, value, onChange }: Props) {
  const [mlsInput, setMlsInput] = useState('')

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
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + tag.length
      el.setSelectionRange(pos, pos)
    })
  }

  function insertListingTag(field: string) {
    const mls = mlsInput.trim() || 'MLSNUMBER'
    insert(`{{listing:${mls}:${field}}}`)
  }

  return (
    <div className="rounded-lg border border-charcoal-100 bg-charcoal-50 px-2 py-1.5 space-y-1.5">
      {/* Standard merge tags */}
      <div className="flex flex-wrap items-center gap-1">
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

      {/* Listing tags */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-charcoal-200 pt-1.5">
        <span className="text-xs text-charcoal-400 shrink-0">Listing:</span>
        <input
          type="text"
          value={mlsInput}
          onChange={e => setMlsInput(e.target.value)}
          placeholder="MLS#"
          className="w-28 rounded border border-charcoal-200 bg-white px-2 py-0.5 text-xs text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-1 focus:ring-charcoal-400 font-mono"
        />
        {LISTING_FIELDS.map(({ field, label }) => (
          <button
            key={field}
            type="button"
            title={`Insert listing ${label.toLowerCase()} tag — uses the MLS# entered above`}
            onClick={() => insertListingTag(field)}
            className="rounded bg-white border border-charcoal-200 px-1.5 py-0.5 text-xs text-charcoal-600 hover:bg-charcoal-900 hover:text-white hover:border-charcoal-900 transition-colors font-mono"
          >
            {`{{listing:…:${field}}}`}
          </button>
        ))}
      </div>
    </div>
  )
}
