# Blur Mode — Design Spec
**Date:** 2026-03-21
**Status:** Approved

---

## Overview

Blur Mode is a privacy toggle for the admin section that blurs sensitive contact details (phone numbers, email addresses, property addresses) across the app. It is designed for use during public demos or when working in shared/public spaces. The setting can be toggled from both the admin settings page and a quick-access button in the top navigation bar.

---

## Goals

- Allow admins to instantly hide sensitive contact data with a single click
- Persist the setting in the database so it survives page reloads
- Provide a prominent, always-visible toggle in the top nav for quick access
- Apply blur consistently across all contact data display surfaces

---

## Non-Goals

- Blurring data on public-facing pages (only applies inside the admin section)
- Masking/redacting data at the API level — this is a visual-only privacy layer
- Per-user blur settings — one global admin setting for the whole session

---

## Architecture

### 1. Data Layer

**SiteSettings table** — one new key-value entry:
- Key: `blur_mode_enabled`
- Value: `"true"` or `"false"` (default: `"false"`)

**`/lib/site-settings.ts`** — extend with:
```ts
export async function getBlurModeEnabled(): Promise<boolean>
```
Uses `unstable_cache` with a `blur_mode` cache tag and 60-second revalidation — consistent with the existing `getGateSettings()` pattern.

**`/app/api/admin/settings/route.ts`** — extend the existing endpoint to handle `blur_mode_enabled` reads and writes. Accepts `{ blurMode: boolean }` in the PATCH body. After any successful write, call `revalidateTag('blur_mode')` unconditionally — this is safe and consistent with how other cached settings tags would be invalidated. The existing GET handler returns all settings as a flat object; no query-parameter filtering is needed or added.

---

### 2. Context & State

**`/components/admin/BlurModeContext.tsx`** — new client component:
- Exports `BlurModeProvider` and `useBlurMode` hook
- On mount, fetches via `GET /api/admin/settings` and reads `data.blur_mode_enabled` from the full settings payload — this avoids threading an `initialEnabled` prop through every admin server page
- State: `isBlurred: boolean` (initially `false` until fetch resolves)
- `toggle()`: optimistically flips local state, fires `PATCH /api/admin/settings` with `{ blurMode: !isBlurred }`, rolls back and shows a toast error if the request fails

**`/components/dashboard/DashboardLayout.tsx`** — updated:
- Wraps children with `<BlurModeProvider>` (no prop needed — provider self-fetches)

No changes required to individual admin server pages to thread props down.

---

### 3. BlurredField Component

**`/components/ui/BlurredField.tsx`** — new client component:

```tsx
'use client'
import { useBlurMode } from '@/components/admin/BlurModeContext'

interface BlurredFieldProps {
  children: React.ReactNode
  className?: string
}

export function BlurredField({ children, className }: BlurredFieldProps) {
  const { isBlurred } = useBlurMode()
  return (
    <span
      className={`transition-all duration-200 ${isBlurred ? 'blur-sm select-none' : ''} ${className ?? ''}`}
      title={isBlurred ? '(blurred — Blur Mode is on)' : undefined}
    >
      {children}
    </span>
  )
}
```

The `blur-sm` Tailwind class applies `filter: blur(4px)`. The `select-none` prevents accidental copy of blurred content. The `transition-all duration-200` gives a smooth on/off animation.

---

### 4. Application Points

`<BlurredField>` is wrapped around sensitive values at these locations:

| File | Fields Wrapped | Notes |
|------|---------------|-------|
| `/components/crm/ContactTable.tsx` | Email column, phone column | Primary contact list surface |
| `/app/admin/contacts/[id]/page.tsx` | All phones, email, all addresses | Contact detail page |
| `/app/admin/deals/[id]/page.tsx` | `p.contact.email` (line 183), `deal.property.address` + `deal.property.city` (line 251) | Rendered directly in JSX, not via ContactTable |

Note: `ContactCard` is defined in `/components/crm/ContactCard.tsx` but is not currently imported or rendered anywhere in the app — it is not an application point at this time.

---

### 5. Top Nav Toggle

**`/components/dashboard/Topbar.tsx`** — updated:
- Imports `useBlurMode` and lucide-react `Eye` / `EyeOff` icons
- Renders a `BlurModeToggle` button between `NotificationBell` and `UserMenu`
- Active state: amber-tinted background (`bg-amber-100 text-amber-700`) with `EyeOff` icon
- Inactive state: standard charcoal hover style with `Eye` icon
- Includes a tooltip/title: `"Blur Mode (on/off)"`

---

### 6. Settings Page Card

**`/components/admin/BlurModeSettingsCard.tsx`** — new client component modelled on `LeadCaptureSettingsCard` for structure and styling, but with the following differences:
- Calls `toggle()` from `useBlurMode()` rather than managing its own API call
- Implements full error handling: on PATCH failure, the context rolls back optimistic state and fires a `useToast` error toast — this is a new addition not present in `LeadCaptureSettingsCard`
- Toggle switch labelled "Blur Mode" with description: "Blur sensitive contact details (phone, email, address) for demos and public use"
- Shows a "Saved" confirmation flash on successful persist

**`/app/admin/settings/page.tsx`** — add `BlurModeSettingsCard` to the settings grid.

---

## Data Flow

```
BlurModeProvider (mounts in DashboardLayout)
  └─ useEffect → GET /api/admin/settings → reads data.blur_mode_enabled
       └─ sets isBlurred: boolean in context

toggle() called from Topbar or Settings card
  └─ optimistic flip of isBlurred
       └─ PATCH /api/admin/settings { blurMode: boolean }
            ├─ success → revalidateTag('blur_mode') on server
            └─ failure → rollback isBlurred, show toast error

<BlurredField> (anywhere in admin)
  └─ reads isBlurred from context → applies/removes blur-sm class
```

---

## Files Created

| File | Type |
|------|------|
| `/components/admin/BlurModeContext.tsx` | New |
| `/components/admin/BlurModeSettingsCard.tsx` | New |
| `/components/ui/BlurredField.tsx` | New |

## Files Modified

| File | Change |
|------|--------|
| `/lib/site-settings.ts` | Add `getBlurModeEnabled()` |
| `/app/api/admin/settings/route.ts` | Handle `blur_mode_enabled` key + call `revalidateTag('blur_mode')` on write |
| `/components/dashboard/DashboardLayout.tsx` | Wrap children with `<BlurModeProvider>` |
| `/components/dashboard/Topbar.tsx` | Add `BlurModeToggle` button |
| `/app/admin/settings/page.tsx` | Add `BlurModeSettingsCard` |
| `/components/crm/ContactTable.tsx` | Wrap email/phone columns in `<BlurredField>` |
| `/app/admin/contacts/[id]/page.tsx` | Wrap phones/email/addresses in `<BlurredField>` |
| `/app/admin/deals/[id]/page.tsx` | Wrap contact email and property address in `<BlurredField>` |

---

## Error Handling

- If the `PATCH` to `/api/admin/settings` fails, the optimistic state is rolled back and a toast error is shown via `useToast`
- If the initial `GET` on mount fails, `isBlurred` stays `false` (blur off) — safe degradation

---

## Testing Checklist

- [ ] Toggle in settings page persists across page reload
- [ ] Toggle in top nav instantly blurs/unblurs all contact fields
- [ ] Both toggles stay in sync (same context)
- [ ] ContactTable blurs email and phone columns
- [ ] Contact detail page blurs all phones, email, and addresses
- [ ] ContactEditModal blurs display fields but not input fields
- [ ] Deal detail page blurs contact email and property address
- [ ] API failure rolls back optimistic state and shows toast
- [ ] Blur mode defaults to off on fresh install
- [ ] `revalidateTag('blur_mode')` is called on successful PATCH so page reload reflects new value
