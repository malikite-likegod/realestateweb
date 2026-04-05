# Campaign Step — Email Template Picker

**Date:** 2026-04-05  
**Status:** Approved

## Problem

The `send_email` step in `CampaignBuilder` requires the user to write subject and body from scratch every time. Existing `EmailTemplate` records are never surfaced during campaign editing, so saved templates go unused in drip sequences.

## Goal

Let users pick an email template from a dropdown inside the `send_email` step. Selecting a template pre-fills the subject and body fields (which remain fully editable). The chosen `templateId` is stored in the step config for analytics linkage.

## Scope

**In scope:**
- Template dropdown in the `send_email` step UI only
- Pre-fill subject, body, and templateId on selection
- Fields remain editable after selection

**Out of scope:**
- Fetching template content at send time (email service already uses subject/body from config)
- Template picker in any other step type
- Creating or editing templates from within the campaign builder

## Design

### Data flow

1. `CampaignBuilder` fetches `/api/email-templates` on mount alongside existing `tags` and `taskTypes` fetches.
2. Templates are stored in a `templates` state variable and passed as a prop to `StepConfig`.
3. In the `send_email` case of `StepConfig`, a `<select>` dropdown appears above the subject field with a "— Load from template —" placeholder plus one `<option>` per template (sorted by name).
4. On selection, three `onChange` calls fire: `subject`, `body`, `templateId` — populating the fields below.
5. The dropdown remains selected at the chosen template name. If the user edits subject/body afterward, `templateId` stays set (it's just an analytics reference, not a live link).

### File changes

| File | Change |
|------|--------|
| `components/crm/CampaignBuilder.tsx` | Add `templates` state + fetch; pass to `StepConfig`; add `templateId: ''` to `defaultConfig('send_email')` |
| `components/crm/CampaignBuilder.tsx` (`StepConfig`) | Accept `templates` prop; render dropdown in `send_email` case; handle selection |

### No changes needed

- `prisma/schema.prisma` — `templateId` already on `AutomationStep.config` (JSON)
- `app/api/campaigns/` — config is a free-form JSON blob
- `lib/automation/campaign-service.ts` — already reads `config.templateId`
- `lib/communications/email-service.ts` — already stores `templateId` for analytics

## UI detail

```
[ send_email step card ]
  Load from template:  [ — Load from template — ▾ ]   ← new dropdown
  Subject:             [ ...pre-filled, editable...  ]
  Body:                [ ...pre-filled, editable...  ]
  Attach a file
```

Dropdown shows only `isActive: true` templates, sorted alphabetically. If no templates exist, the dropdown is hidden (no empty picker shown).
