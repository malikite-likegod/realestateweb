# Campaign Step Email Template Picker — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a template-picker dropdown to the `send_email` step in `CampaignBuilder` that pre-fills subject and body from a saved `EmailTemplate`.

**Architecture:** Fetch all active templates once on mount in `CampaignBuilder`, pass them as a prop to `StepConfig`, and render a `<select>` at the top of the `send_email` case. Selecting a template calls the existing `onChange` handler three times — subject, body, templateId — leaving the fields fully editable. No API, schema, or service changes required.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind (`charcoal-*` / `gold-*`)

**Spec:** `docs/superpowers/specs/2026-04-05-campaign-step-template-picker-design.md`

---

## Chunk 1: CampaignBuilder changes

**File:** `components/crm/CampaignBuilder.tsx`

### Task 1: Add `templateId` to `defaultConfig` for `send_email`

- [ ] Open `components/crm/CampaignBuilder.tsx` and find `defaultConfig` (~line 116).
- [ ] Change the `send_email` case from:
  ```ts
  case 'send_email': return { subject: '', body: '' }
  ```
  to:
  ```ts
  case 'send_email': return { subject: '', body: '', templateId: '' }
  ```
- [ ] Verify TypeScript still compiles: `npx tsc --noEmit`

### Task 2: Add `templates` state and fetch in `CampaignBuilder`

- [ ] Add the `EmailTemplate` interface near the top of the file (after the existing interfaces):
  ```ts
  interface EmailTemplateOption {
    id:      string
    name:    string
    subject: string
    body:    string
  }
  ```
- [ ] Inside `CampaignBuilder`, add state alongside the existing `tags` / `taskTypes` state (~line 150):
  ```ts
  const [templates, setTemplates] = useState<EmailTemplateOption[]>([])
  ```
- [ ] In the existing `useEffect` that fetches tags and taskTypes (~line 160), add a third fetch alongside the others. The `useEffect` callback currently has two fetch calls; expand it to include a third:
  ```ts
  fetch('/api/email-templates')
    .then(r => r.json())
    .then(d => setTemplates(
      // d.data follows the same { data: [] } envelope every other fetch in this file uses
      (d.data ?? [])
        .filter((t: { isActive: boolean; id: string; name: string; subject: string; body: string }) => t.isActive)
        .sort((a: EmailTemplateOption, b: EmailTemplateOption) => a.name.localeCompare(b.name))
    ))
    .catch(() => {})
  ```
- [ ] Verify TypeScript: `npx tsc --noEmit`

### Task 3: Pass `templates` to `StepConfig`

- [ ] Find the `<StepConfig ... />` JSX call (~line 391). Add the `templates` prop:
  ```tsx
  <StepConfig
    type={step.type}
    config={step.config}
    onChange={(k, v) => updateConfig(i, k, v)}
    allCampaigns={allCampaigns}
    currentCampaignId={campaignId ?? currentCampaignId}
    templates={templates}
  />
  ```
- [ ] Find the `StepConfig` function signature (~line 413) and add the `templates` prop:
  ```ts
  function StepConfig({ type, config, onChange, allCampaigns, currentCampaignId, templates }: {
    type:               StepType
    config:             Record<string, string | number>
    onChange:           (key: string, value: string | number) => void
    allCampaigns?:      CampaignSummary[]
    currentCampaignId?: string
    templates?:         EmailTemplateOption[]
  })
  ```
- [ ] Verify TypeScript: `npx tsc --noEmit`

### Task 4: Add the template dropdown to the `send_email` case

- [ ] Find the `send_email` case in `StepConfig` (~line 430). Replace it with:
  ```tsx
  case 'send_email': {
    const activeTemplates = templates ?? []
    return (
      <div className="flex flex-col gap-2">
        {activeTemplates.length > 0 && (
          <select
            value={config.templateId as string || ''}
            onChange={e => {
              const tpl = activeTemplates.find(t => t.id === e.target.value)
              if (tpl) {
                onChange('templateId', tpl.id)
                onChange('subject',    tpl.subject)
                onChange('body',       tpl.body)
              } else {
                onChange('templateId', '')
              }
            }}
            className="w-full rounded-lg border border-charcoal-200 bg-white px-2 py-1 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
          >
            <option value="">— Load from template —</option>
            {activeTemplates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        <input type="text" placeholder="Email subject" value={config.subject as string}
          onChange={e => onChange('subject', e.target.value)} className={inputCls} />
        <MergeTagPicker textareaRef={bodyRef} value={config.body as string} onChange={v => onChange('body', v)} />
        <textarea ref={bodyRef} placeholder="Email body (HTML allowed)" rows={3} value={config.body as string}
          onChange={e => onChange('body', e.target.value)}
          className={`${inputCls} resize-none font-mono`} />

        {/* Attachment */}
        {config.attachmentName ? (
          <div className="flex items-center gap-2 text-xs text-charcoal-700">
            <Paperclip size={11} className="text-charcoal-400 shrink-0" />
            <span className="truncate flex-1">{config.attachmentName as string}</span>
            <button type="button" onClick={clearAttachment} className="text-charcoal-400 hover:text-red-500 transition-colors">
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1.5 text-xs text-charcoal-500 hover:text-charcoal-800 transition-colors"
          >
            <Paperclip size={13} />
            Attach a file
          </button>
        )}

        {showPicker && (
          <FilePicker
            multiple={false}
            onSelect={([picked]) => {
              if (picked) {
                onChange('attachmentUrl',  picked.url)
                onChange('attachmentName', picked.name)
              }
              setShowPicker(false)
            }}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    )
  }
  ```
- [ ] Note: Replace the entire existing `send_email` case (the old `return (...)` block) with the block-scoped version above. The case uses `return` inside the block (not `break`) — this matches the pattern of every other case in the switch.
- [ ] Verify TypeScript: `npx tsc --noEmit`

### Task 5: Manual verification

- [ ] Run the dev server: `npm run dev`
- [ ] Navigate to the automation/campaigns page and open a campaign for editing (or create a new one).
- [ ] Confirm: with no email templates saved, the dropdown does NOT appear in the send_email step.
- [ ] Create an email template at `/admin/email-templates` if none exist.
- [ ] Return to the campaign, add or edit a `send_email` step, confirm the template dropdown appears.
- [ ] Select a template — confirm subject and body pre-fill.
- [ ] Edit the subject or body manually — confirm fields are editable after selection.
- [ ] Save the campaign — confirm no errors.

### Task 6: Commit

- [ ] Commit the changes:
  ```bash
  git add components/crm/CampaignBuilder.tsx
  git commit -m "feat: add email template picker to send_email campaign step"
  ```
