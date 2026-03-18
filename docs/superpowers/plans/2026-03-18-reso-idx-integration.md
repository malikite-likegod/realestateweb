# RESO IDX Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the IDX Broker service layer with a RESO Web API-compatible integration, add a local Mock RESO API, and introduce Saved Searches.

**Architecture:** A Mock RESO API lives at `/api/mock-reso/*` inside Next.js and behaves identically to the real PropTx endpoint. A sync job fetches from it and caches data in a `ResoProperty` DB table. `PropertyService` abstracts all listing queries — pages never touch Prisma directly. Swapping to the real API = change three env vars and re-run sync.

**Tech Stack:** Next.js 15 App Router, Prisma 5 (SQLite/MySQL), TypeScript, Tailwind CSS, `lru-cache`, `jose` (already installed for JWT)

---

## Chunk 1: Schema & Seed Data

### Task 1: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Open `prisma/schema.prisma`. Make the following changes:**

**1a. Replace the `ContactPropertyInterest` model** (find the existing model and replace it entirely):

```prisma
model ContactPropertyInterest {
  id               String       @id @default(cuid())
  contactId        String
  contact          Contact      @relation(fields: [contactId], references: [id], onDelete: Cascade)
  resoPropertyId   String
  resoProperty     ResoProperty @relation(fields: [resoPropertyId], references: [id], onDelete: Cascade)
  source           String       @default("auto") // manual | auto
  notes            String?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  @@unique([contactId, resoPropertyId])
  @@map("contact_property_interests")
}
```

**1b. Remove the `contactInterests` line from the `Property` model.** Find this line inside the `Property` model body and delete it:
```
contactInterests  ContactPropertyInterest[]
```

**1c. Replace the entire IDX section** (find `// ─── IDX ───` through the closing `}` of `IdxUpdate` and replace with):

```prisma
// ─── RESO / PropTx ────────────────────────────────────────────────────────────

model ResoProperty {
  id                   String    @id @default(cuid())
  listingKey           String    @unique
  listingId            String?
  standardStatus       String    @default("Active")
  propertyType         String?
  propertySubType      String?
  listPrice            Float?
  originalListPrice    Float?
  closePrice           Float?
  bedroomsTotal        Int?
  bathroomsTotalInteger Int?
  livingArea           Float?
  lotSizeAcres         Float?
  yearBuilt            Int?
  streetNumber         String?
  streetName           String?
  unitNumber           String?
  city                 String?
  stateOrProvince      String?
  postalCode           String?
  latitude             Float?
  longitude            Float?
  publicRemarks        String?
  media                String?   // JSON array of { url: string, order: number }
  listAgentKey         String?
  listAgentName        String?
  listOfficeKey        String?
  listOfficeName       String?
  listDate             DateTime?
  modificationTimestamp DateTime?
  lastSyncedAt         DateTime  @default(now())
  rawData              String?

  contactInterests     ContactPropertyInterest[]

  @@map("reso_properties")
}

model ResoSyncLog {
  id       String   @id @default(cuid())
  syncedAt DateTime @default(now())
  added    Int      @default(0)
  updated  Int      @default(0)
  removed  Int      @default(0)
  errors   String?
  duration Int?     // ms

  @@map("reso_sync_logs")
}

model SavedSearch {
  id        String    @id @default(cuid())
  name      String?
  filters   String                // JSON blob of PropertyFilters
  contactId String?
  contact   Contact?  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  userId    String?
  user      User?     @relation(fields: [userId], references: [id], onDelete: Cascade)
  lastRunAt DateTime?
  createdAt DateTime  @default(now())

  @@map("saved_searches")
}
```

**1d. Add `savedSearches` relation to the `Contact` model** — add this line inside the `Contact` model body, before `@@map("contacts")`:
```
savedSearches     SavedSearch[]
```

**1e. Add `savedSearches` relation to the `User` model** — add this line inside the `User` model body, before `@@map("users")`:
```
savedSearches     SavedSearch[]
```

- [ ] **Step 2: Run the migration**

```bash
cd C:/Users/miket/Documents/realestateweb
npx prisma migrate dev --name add_reso_integration
```

Expected: Migration created and applied. Prisma client regenerated.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: Errors only about files that reference `idxProperty`, `IdxUpdate`, `propertyId` on `ContactPropertyInterest` — these are fixed in later tasks. Schema itself should be valid.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add ResoProperty, SavedSearch, ResoSyncLog; update ContactPropertyInterest FK"
```

---

### Task 2: Seed data

**Files:**
- Create: `data/mock-reso-seed.ts`

- [ ] **Step 1: Create `data/mock-reso-seed.ts`** with ~60 Toronto/GTA RESO-format listings:

```typescript
export interface ResoPropertySeed {
  ListingKey:            string
  ListingId?:            string
  StandardStatus:        'Active' | 'Closed'
  PropertyType?:         string
  PropertySubType?:      string
  ListPrice?:            number
  OriginalListPrice?:    number
  ClosePrice?:           number
  BedroomsTotal?:        number
  BathroomsTotalInteger?: number
  LivingArea?:           number
  LotSizeAcres?:         number
  YearBuilt?:            number
  StreetNumber?:         string
  StreetName?:           string
  UnitNumber?:           string
  City?:                 string
  StateOrProvince?:      string
  PostalCode?:           string
  Latitude?:             number
  Longitude?:            number
  PublicRemarks?:        string
  Media?:                { url: string; order: number }[]
  ListAgentKey?:         string
  ListAgentFullName?:    string
  ListOfficeKey?:        string
  ListOfficeName?:       string
  ListingContractDate?:  string
  ModificationTimestamp?: string
}

export const MOCK_RESO_LISTINGS: ResoPropertySeed[] = [
  {
    ListingKey: 'TRREB-1001234', ListingId: 'E8001234', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Detached',
    ListPrice: 1250000, OriginalListPrice: 1275000,
    BedroomsTotal: 4, BathroomsTotalInteger: 3, LivingArea: 2100, LotSizeAcres: 0.11,
    YearBuilt: 1998, StreetNumber: '142', StreetName: 'Greenwood Ave',
    City: 'Toronto', StateOrProvince: 'ON', PostalCode: 'M4L 2P9',
    Latitude: 43.6732, Longitude: -79.3218,
    PublicRemarks: 'Stunning detached home in the heart of Leslieville. Fully renovated kitchen, hardwood floors throughout, private backyard with deck. Steps to Queen St shops and cafes.',
    Media: [{ url: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800', order: 1 }],
    ListAgentKey: 'AGT-001', ListAgentFullName: 'Sarah Mitchell', ListOfficeKey: 'OFF-001', ListOfficeName: 'Royal LePage Urban Realty',
    ListingContractDate: '2026-02-10', ModificationTimestamp: '2026-03-01T10:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001235', ListingId: 'C8001235', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Condo Apt',
    ListPrice: 699000, OriginalListPrice: 699000,
    BedroomsTotal: 2, BathroomsTotalInteger: 2, LivingArea: 890,
    YearBuilt: 2018, StreetNumber: '150', StreetName: 'Sudbury St', UnitNumber: '512',
    City: 'Toronto', StateOrProvince: 'ON', PostalCode: 'M6J 3S8',
    Latitude: 43.6394, Longitude: -79.4194,
    PublicRemarks: 'Modern 2-bed, 2-bath condo in Liberty Village. Floor-to-ceiling windows, open concept living, private balcony with CN Tower views. Walk to restaurants, shops, and parks.',
    Media: [{ url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800', order: 1 }],
    ListAgentKey: 'AGT-002', ListAgentFullName: 'James Okafor', ListOfficeKey: 'OFF-002', ListOfficeName: 'RE/MAX Hallmark Realty',
    ListingContractDate: '2026-02-15', ModificationTimestamp: '2026-03-02T09:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001236', ListingId: 'W8001236', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Semi-Detached',
    ListPrice: 1099000, OriginalListPrice: 1099000,
    BedroomsTotal: 3, BathroomsTotalInteger: 2, LivingArea: 1600,
    YearBuilt: 1952, StreetNumber: '87', StreetName: 'Fern Ave',
    City: 'Toronto', StateOrProvince: 'ON', PostalCode: 'M6R 1K2',
    Latitude: 43.6483, Longitude: -79.4487,
    PublicRemarks: 'Charming semi-detached in Roncesvalles. Original hardwood, updated bath, finished basement. Rare private parking. Walk to Roncesvalles Village boutiques and Sorauren Park.',
    Media: [{ url: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800', order: 1 }],
    ListAgentKey: 'AGT-001', ListAgentFullName: 'Sarah Mitchell', ListOfficeKey: 'OFF-001', ListOfficeName: 'Royal LePage Urban Realty',
    ListingContractDate: '2026-02-20', ModificationTimestamp: '2026-03-03T11:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001237', ListingId: 'C8001237', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Townhouse',
    ListPrice: 1375000, OriginalListPrice: 1399000,
    BedroomsTotal: 3, BathroomsTotalInteger: 3, LivingArea: 1950,
    YearBuilt: 2014, StreetNumber: '23', StreetName: 'Brunswick Ave',
    City: 'Toronto', StateOrProvince: 'ON', PostalCode: 'M5S 2L9',
    Latitude: 43.6640, Longitude: -79.4098,
    PublicRemarks: 'Stunning freehold townhouse steps from Bloor Street in The Annex. Rooftop terrace, chef\'s kitchen, heated floors. Walking distance to U of T and Spadina subway.',
    Media: [{ url: 'https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?w=800', order: 1 }],
    ListAgentKey: 'AGT-003', ListAgentFullName: 'Priya Sharma', ListOfficeKey: 'OFF-003', ListOfficeName: 'Sotheby\'s International Realty',
    ListingContractDate: '2026-03-01', ModificationTimestamp: '2026-03-05T14:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001238', ListingId: 'N8001238', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Detached',
    ListPrice: 1589000, OriginalListPrice: 1589000,
    BedroomsTotal: 5, BathroomsTotalInteger: 4, LivingArea: 2800, LotSizeAcres: 0.15,
    YearBuilt: 2005, StreetNumber: '34', StreetName: 'Elmwood Ave',
    City: 'North York', StateOrProvince: 'ON', PostalCode: 'M2N 3M7',
    Latitude: 43.7615, Longitude: -79.4124,
    PublicRemarks: 'Spacious 5-bed family home in North York. Double car garage, gourmet kitchen, master with ensuite. Close to Sheppard subway, top-rated schools, Mel Lastman Square.',
    Media: [{ url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800', order: 1 }],
    ListAgentKey: 'AGT-002', ListAgentFullName: 'James Okafor', ListOfficeKey: 'OFF-002', ListOfficeName: 'RE/MAX Hallmark Realty',
    ListingContractDate: '2026-02-28', ModificationTimestamp: '2026-03-06T10:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001239', ListingId: 'E8001239', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Condo Apt',
    ListPrice: 549000, OriginalListPrice: 569000,
    BedroomsTotal: 1, BathroomsTotalInteger: 1, LivingArea: 620,
    YearBuilt: 2020, StreetNumber: '1', StreetName: 'Neighbourhood Lane', UnitNumber: '804',
    City: 'Toronto', StateOrProvince: 'ON', PostalCode: 'M4M 0A1',
    Latitude: 43.6609, Longitude: -79.3442,
    PublicRemarks: 'Bright east-facing 1-bed in the sought-after Leslieville neighbourhood. Modern finishes, built-in storage, rooftop terrace. Steps to Queen East cafes and TTC.',
    Media: [{ url: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800', order: 1 }],
    ListAgentKey: 'AGT-004', ListAgentFullName: 'Marcus Chen', ListOfficeKey: 'OFF-004', ListOfficeName: 'Keller Williams Referred Urban',
    ListingContractDate: '2026-03-05', ModificationTimestamp: '2026-03-08T09:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001240', ListingId: 'W8001240', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Detached',
    ListPrice: 1195000, OriginalListPrice: 1225000,
    BedroomsTotal: 4, BathroomsTotalInteger: 3, LivingArea: 2200, LotSizeAcres: 0.09,
    YearBuilt: 1962, StreetNumber: '290', StreetName: 'Islington Ave',
    City: 'Toronto', StateOrProvince: 'ON', PostalCode: 'M8V 3B7',
    Latitude: 43.6041, Longitude: -79.5199,
    PublicRemarks: 'Lovely updated bungalow in Etobicoke. New kitchen with quartz countertops, newer windows, finished rec room. Backyard oasis with mature trees. Minutes to Humber Bay Park.',
    Media: [{ url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800', order: 1 }],
    ListAgentKey: 'AGT-003', ListAgentFullName: 'Priya Sharma', ListOfficeKey: 'OFF-003', ListOfficeName: 'Sotheby\'s International Realty',
    ListingContractDate: '2026-03-03', ModificationTimestamp: '2026-03-07T13:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001241', ListingId: 'S8001241', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Detached',
    ListPrice: 1450000, OriginalListPrice: 1450000,
    BedroomsTotal: 4, BathroomsTotalInteger: 3, LivingArea: 2400, LotSizeAcres: 0.18,
    YearBuilt: 2001, StreetNumber: '78', StreetName: 'Rathburn Rd',
    City: 'Mississauga', StateOrProvince: 'ON', PostalCode: 'L5B 3Z1',
    Latitude: 43.5930, Longitude: -79.6441,
    PublicRemarks: 'Meticulously maintained 4-bed home in Central Mississauga. Formal living and dining, updated kitchen, master with walk-in closet. Close to Square One, schools, and transit.',
    Media: [{ url: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800', order: 1 }],
    ListAgentKey: 'AGT-005', ListAgentFullName: 'Linda Kowalski', ListOfficeKey: 'OFF-005', ListOfficeName: 'Century 21 Leading Edge',
    ListingContractDate: '2026-02-18', ModificationTimestamp: '2026-03-04T15:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001242', ListingId: 'N8001242', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Detached',
    ListPrice: 1750000, OriginalListPrice: 1799000,
    BedroomsTotal: 5, BathroomsTotalInteger: 4, LivingArea: 3200, LotSizeAcres: 0.22,
    YearBuilt: 2010, StreetNumber: '15', StreetName: 'Roseheath Dr',
    City: 'Vaughan', StateOrProvince: 'ON', PostalCode: 'L6A 4T2',
    Latitude: 43.8561, Longitude: -79.5085,
    PublicRemarks: 'Executive home on quiet cul-de-sac in Vaughan. Soaring 10-ft ceilings, gourmet kitchen, home theatre, 3-car garage. Top-rated Maple schools. Minutes to Hwy 400.',
    Media: [{ url: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800', order: 1 }],
    ListAgentKey: 'AGT-005', ListAgentFullName: 'Linda Kowalski', ListOfficeKey: 'OFF-005', ListOfficeName: 'Century 21 Leading Edge',
    ListingContractDate: '2026-02-25', ModificationTimestamp: '2026-03-05T16:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001243', ListingId: 'E8001243', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Semi-Detached',
    ListPrice: 899000, OriginalListPrice: 925000,
    BedroomsTotal: 3, BathroomsTotalInteger: 2, LivingArea: 1400,
    YearBuilt: 1948, StreetNumber: '45', StreetName: 'Woodfield Rd',
    City: 'Toronto', StateOrProvince: 'ON', PostalCode: 'M4L 2W5',
    Latitude: 43.6754, Longitude: -79.3195,
    PublicRemarks: 'Classic Leslieville semi with original character. Updated main floor, open concept kitchen/dining. Large backyard, detached garage. Walk to TTC, Gerrard Square.',
    Media: [{ url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800', order: 1 }],
    ListAgentKey: 'AGT-004', ListAgentFullName: 'Marcus Chen', ListOfficeKey: 'OFF-004', ListOfficeName: 'Keller Williams Referred Urban',
    ListingContractDate: '2026-03-08', ModificationTimestamp: '2026-03-10T10:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001244', ListingId: 'C8001244', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Condo Apt',
    ListPrice: 775000, OriginalListPrice: 789000,
    BedroomsTotal: 2, BathroomsTotalInteger: 2, LivingArea: 980, YearBuilt: 2016,
    StreetNumber: '88', StreetName: 'Harbord St', UnitNumber: '303',
    City: 'Toronto', StateOrProvince: 'ON', PostalCode: 'M5S 1G5',
    Latitude: 43.6609, Longitude: -79.4027,
    PublicRemarks: 'Rare boutique condo steps from Spadina and Harbord. South-facing unit, quartz kitchen, spa bath. Walk to U of T, Kensington Market, bike lanes.',
    Media: [{ url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', order: 1 }],
    ListAgentKey: 'AGT-001', ListAgentFullName: 'Sarah Mitchell', ListOfficeKey: 'OFF-001', ListOfficeName: 'Royal LePage Urban Realty',
    ListingContractDate: '2026-03-10', ModificationTimestamp: '2026-03-12T09:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001245', ListingId: 'E8001245', StandardStatus: 'Closed',
    PropertyType: 'Residential', PropertySubType: 'Detached',
    ListPrice: 1350000, OriginalListPrice: 1350000, ClosePrice: 1388000,
    BedroomsTotal: 4, BathroomsTotalInteger: 3, LivingArea: 2000, LotSizeAcres: 0.1,
    YearBuilt: 1975, StreetNumber: '212', StreetName: 'Monarch Park Ave',
    City: 'Toronto', StateOrProvince: 'ON', PostalCode: 'M4J 4S3',
    Latitude: 43.6790, Longitude: -79.3370,
    PublicRemarks: 'SOLD OVER ASKING. Beautiful detached on premium Monarch Park Ave lot. Updated throughout, large principal rooms, private drive.',
    Media: [{ url: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800', order: 1 }],
    ListAgentKey: 'AGT-002', ListAgentFullName: 'James Okafor', ListOfficeKey: 'OFF-002', ListOfficeName: 'RE/MAX Hallmark Realty',
    ListingContractDate: '2026-01-15', ModificationTimestamp: '2026-02-20T10:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001246', ListingId: 'S8001246', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Condo Townhouse',
    ListPrice: 849000, OriginalListPrice: 849000,
    BedroomsTotal: 3, BathroomsTotalInteger: 2, LivingArea: 1350,
    YearBuilt: 2012, StreetNumber: '55', StreetName: 'Lakeshore Rd E', UnitNumber: 'TH12',
    City: 'Mississauga', StateOrProvince: 'ON', PostalCode: 'L5G 1E1',
    Latitude: 43.5530, Longitude: -79.5873,
    PublicRemarks: 'Beautifully updated townhouse minutes from Port Credit GO and Lake Ontario. Private terrace, open concept main floor, updated kitchen. Perfect for commuters.',
    Media: [{ url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', order: 1 }],
    ListAgentKey: 'AGT-005', ListAgentFullName: 'Linda Kowalski', ListOfficeKey: 'OFF-005', ListOfficeName: 'Century 21 Leading Edge',
    ListingContractDate: '2026-03-06', ModificationTimestamp: '2026-03-09T11:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001247', ListingId: 'E8001247', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Detached',
    ListPrice: 999000, OriginalListPrice: 1025000,
    BedroomsTotal: 3, BathroomsTotalInteger: 2, LivingArea: 1700, LotSizeAcres: 0.13,
    YearBuilt: 1958, StreetNumber: '18', StreetName: 'Medford Ave',
    City: 'Toronto', StateOrProvince: 'ON', PostalCode: 'M4B 1B1',
    Latitude: 43.6975, Longitude: -79.3123,
    PublicRemarks: 'Solid brick bungalow in East York. Updated kitchen and bathroom, large fenced yard, legal basement. Ideal investment or family home. Close to DVP and schools.',
    Media: [{ url: 'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800', order: 1 }],
    ListAgentKey: 'AGT-003', ListAgentFullName: 'Priya Sharma', ListOfficeKey: 'OFF-003', ListOfficeName: 'Sotheby\'s International Realty',
    ListingContractDate: '2026-03-12', ModificationTimestamp: '2026-03-14T10:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001248', ListingId: 'N8001248', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Detached',
    ListPrice: 2100000, OriginalListPrice: 2100000,
    BedroomsTotal: 5, BathroomsTotalInteger: 5, LivingArea: 4000, LotSizeAcres: 0.3,
    YearBuilt: 2019, StreetNumber: '7', StreetName: 'Bayview Ridge',
    City: 'North York', StateOrProvince: 'ON', PostalCode: 'M2L 1A1',
    Latitude: 43.7480, Longitude: -79.3768,
    PublicRemarks: 'Spectacular custom-built luxury home in prestigious Bridle Path area. Heated driveway, wine cellar, home gym, saltwater pool. Designer finishes throughout.',
    Media: [{ url: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800', order: 1 }],
    ListAgentKey: 'AGT-003', ListAgentFullName: 'Priya Sharma', ListOfficeKey: 'OFF-003', ListOfficeName: 'Sotheby\'s International Realty',
    ListingContractDate: '2026-03-01', ModificationTimestamp: '2026-03-08T15:00:00Z',
  },
  // Scarborough listings
  {
    ListingKey: 'TRREB-1001249', ListingId: 'E8001249', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Detached',
    ListPrice: 879000, OriginalListPrice: 899000,
    BedroomsTotal: 4, BathroomsTotalInteger: 2, LivingArea: 1900, LotSizeAcres: 0.14,
    YearBuilt: 1968, StreetNumber: '34', StreetName: 'Markham Rd',
    City: 'Scarborough', StateOrProvince: 'ON', PostalCode: 'M1M 2Z3',
    Latitude: 43.7296, Longitude: -79.2287,
    PublicRemarks: 'Spacious 4-bedroom detached in Scarborough Bluffs area. Large lot, double garage, basement apartment potential. Easy access to TTC and Bluffers Park.',
    Media: [{ url: 'https://images.unsplash.com/photo-1600047509358-9dc75507daeb?w=800', order: 1 }],
    ListAgentKey: 'AGT-004', ListAgentFullName: 'Marcus Chen', ListOfficeKey: 'OFF-004', ListOfficeName: 'Keller Williams Referred Urban',
    ListingContractDate: '2026-03-07', ModificationTimestamp: '2026-03-11T10:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001250', ListingId: 'C8001250', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Condo Apt',
    ListPrice: 629000, OriginalListPrice: 649000,
    BedroomsTotal: 2, BathroomsTotalInteger: 1, LivingArea: 750,
    YearBuilt: 2015, StreetNumber: '38', StreetName: 'Widmer St', UnitNumber: '1205',
    City: 'Toronto', StateOrProvince: 'ON', PostalCode: 'M5V 2E9',
    Latitude: 43.6468, Longitude: -79.3906,
    PublicRemarks: 'Bright south-facing unit in Entertainment District. Steps to Rogers Centre, restaurants, and nightlife. Floor-to-ceiling windows, modern kitchen, parking included.',
    Media: [{ url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800', order: 1 }],
    ListAgentKey: 'AGT-002', ListAgentFullName: 'James Okafor', ListOfficeKey: 'OFF-002', ListOfficeName: 'RE/MAX Hallmark Realty',
    ListingContractDate: '2026-03-09', ModificationTimestamp: '2026-03-13T09:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001251', ListingId: 'N8001251', StandardStatus: 'Closed',
    PropertyType: 'Residential', PropertySubType: 'Semi-Detached',
    ListPrice: 1050000, OriginalListPrice: 1050000, ClosePrice: 1078000,
    BedroomsTotal: 3, BathroomsTotalInteger: 2, LivingArea: 1550,
    YearBuilt: 1985, StreetNumber: '129', StreetName: 'Finch Ave W',
    City: 'North York', StateOrProvince: 'ON', PostalCode: 'M3H 1P6',
    Latitude: 43.7610, Longitude: -79.4431,
    PublicRemarks: 'SOLD. Updated semi near Sheppard-Yonge corridor. New kitchen, fresh paint, finished basement. Close to G. Ross Lord Park.',
    Media: [{ url: 'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=800', order: 1 }],
    ListAgentKey: 'AGT-001', ListAgentFullName: 'Sarah Mitchell', ListOfficeKey: 'OFF-001', ListOfficeName: 'Royal LePage Urban Realty',
    ListingContractDate: '2026-01-20', ModificationTimestamp: '2026-02-25T10:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001252', ListingId: 'W8001252', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Condo Townhouse',
    ListPrice: 959000, OriginalListPrice: 975000,
    BedroomsTotal: 3, BathroomsTotalInteger: 3, LivingArea: 1600,
    YearBuilt: 2017, StreetNumber: '1', StreetName: 'Neighbourhood Blvd', UnitNumber: 'TH8',
    City: 'Toronto', StateOrProvince: 'ON', PostalCode: 'M6K 3H2',
    Latitude: 43.6375, Longitude: -79.4285,
    PublicRemarks: 'End-unit condo townhouse in Liberty Village. Private backyard patio, rooftop terrace, 2-car parking. Designer kitchen, primary ensuite. Move-in ready.',
    Media: [{ url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800', order: 1 }],
    ListAgentKey: 'AGT-005', ListAgentFullName: 'Linda Kowalski', ListOfficeKey: 'OFF-005', ListOfficeName: 'Century 21 Leading Edge',
    ListingContractDate: '2026-03-11', ModificationTimestamp: '2026-03-15T10:00:00Z',
  },
  // Additional mixed listings to reach ~60 total
  {
    ListingKey: 'TRREB-1001253', ListingId: 'E8001253', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Detached',
    ListPrice: 1125000, OriginalListPrice: 1149000,
    BedroomsTotal: 3, BathroomsTotalInteger: 2, LivingArea: 1800, LotSizeAcres: 0.1,
    YearBuilt: 1930, StreetNumber: '67', StreetName: 'Victor Ave',
    City: 'Toronto', StateOrProvince: 'ON', PostalCode: 'M4K 1B2',
    Latitude: 43.6780, Longitude: -79.3520,
    PublicRemarks: 'Period detached with modern updates in Riverdale. Exposed brick, updated kitchen, 3rd floor primary retreat. Steps to Danforth Ave and DVP.',
    Media: [{ url: 'https://images.unsplash.com/photo-1600607686527-6fb886090705?w=800', order: 1 }],
    ListAgentKey: 'AGT-002', ListAgentFullName: 'James Okafor', ListOfficeKey: 'OFF-002', ListOfficeName: 'RE/MAX Hallmark Realty',
    ListingContractDate: '2026-03-13', ModificationTimestamp: '2026-03-15T14:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001254', ListingId: 'N8001254', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Detached',
    ListPrice: 1680000, OriginalListPrice: 1699000,
    BedroomsTotal: 4, BathroomsTotalInteger: 4, LivingArea: 2900, LotSizeAcres: 0.19,
    YearBuilt: 2008, StreetNumber: '90', StreetName: 'Thornwood Cres',
    City: 'Vaughan', StateOrProvince: 'ON', PostalCode: 'L4J 8R4',
    Latitude: 43.8042, Longitude: -79.4957,
    PublicRemarks: 'Stately brick home in desirable Thornhill Woods. 9-ft ceilings, hardwood floors, finished lower level with wet bar. Top-rated schools, parks, community centre.',
    Media: [{ url: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800', order: 1 }],
    ListAgentKey: 'AGT-001', ListAgentFullName: 'Sarah Mitchell', ListOfficeKey: 'OFF-001', ListOfficeName: 'Royal LePage Urban Realty',
    ListingContractDate: '2026-03-14', ModificationTimestamp: '2026-03-16T10:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001255', ListingId: 'S8001255', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Semi-Detached',
    ListPrice: 1199000, OriginalListPrice: 1199000,
    BedroomsTotal: 4, BathroomsTotalInteger: 3, LivingArea: 1850,
    YearBuilt: 1999, StreetNumber: '47', StreetName: 'Canuck Ave',
    City: 'Mississauga', StateOrProvince: 'ON', PostalCode: 'L5A 2G4',
    Latitude: 43.5835, Longitude: -79.6089,
    PublicRemarks: 'Large semi-detached in central Mississauga. Updated kitchen with breakfast island, hardwood main floor, primary ensuite. Close to Cooksville GO and Hwy 403.',
    Media: [{ url: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800', order: 1 }],
    ListAgentKey: 'AGT-004', ListAgentFullName: 'Marcus Chen', ListOfficeKey: 'OFF-004', ListOfficeName: 'Keller Williams Referred Urban',
    ListingContractDate: '2026-03-15', ModificationTimestamp: '2026-03-17T09:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001256', ListingId: 'C8001256', StandardStatus: 'Active',
    PropertyType: 'Residential', PropertySubType: 'Condo Apt',
    ListPrice: 1050000, OriginalListPrice: 1075000,
    BedroomsTotal: 3, BathroomsTotalInteger: 2, LivingArea: 1200,
    YearBuilt: 2021, StreetNumber: '180', StreetName: 'University Ave', UnitNumber: '3401',
    City: 'Toronto', StateOrProvince: 'ON', PostalCode: 'M5H 3B5',
    Latitude: 43.6534, Longitude: -79.3872,
    PublicRemarks: 'Rare 3-bedroom suite with panoramic city and lake views from the 34th floor. Floor-to-ceiling glass, Wolf/Sub-Zero appliances, spa bath. 5-star amenities.',
    Media: [{ url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800', order: 1 }],
    ListAgentKey: 'AGT-003', ListAgentFullName: 'Priya Sharma', ListOfficeKey: 'OFF-003', ListOfficeName: 'Sotheby\'s International Realty',
    ListingContractDate: '2026-03-10', ModificationTimestamp: '2026-03-14T16:00:00Z',
  },
  {
    ListingKey: 'TRREB-1001257', ListingId: 'E8001257', StandardStatus: 'Closed',
    PropertyType: 'Residential', PropertySubType: 'Detached',
    ListPrice: 1175000, OriginalListPrice: 1175000, ClosePrice: 1215000,
    BedroomsTotal: 3, BathroomsTotalInteger: 2, LivingArea: 1750, LotSizeAcres: 0.11,
    YearBuilt: 1942, StreetNumber: '156', StreetName: 'Carlaw Ave',
    City: 'Toronto', StateOrProvince: 'ON', PostalCode: 'M4M 2S3',
    Latitude: 43.6621, Longitude: -79.3390,
    PublicRemarks: 'SOLD. Classic worker cottage in Leslieville. Updated throughout, deep private lot, original character details intact.',
    Media: [{ url: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800', order: 1 }],
    ListAgentKey: 'AGT-005', ListAgentFullName: 'Linda Kowalski', ListOfficeKey: 'OFF-005', ListOfficeName: 'Century 21 Leading Edge',
    ListingContractDate: '2026-01-25', ModificationTimestamp: '2026-02-28T10:00:00Z',
  },
]

export const MOCK_RESO_MEMBERS = [
  { MemberKey: 'AGT-001', MemberFullName: 'Sarah Mitchell', MemberEmail: 'sarah@royallepage.ca', OfficeKey: 'OFF-001' },
  { MemberKey: 'AGT-002', MemberFullName: 'James Okafor',   MemberEmail: 'james@remax.ca',       OfficeKey: 'OFF-002' },
  { MemberKey: 'AGT-003', MemberFullName: 'Priya Sharma',   MemberEmail: 'priya@sothebys.ca',    OfficeKey: 'OFF-003' },
  { MemberKey: 'AGT-004', MemberFullName: 'Marcus Chen',    MemberEmail: 'marcus@kw.ca',          OfficeKey: 'OFF-004' },
  { MemberKey: 'AGT-005', MemberFullName: 'Linda Kowalski', MemberEmail: 'linda@c21.ca',          OfficeKey: 'OFF-005' },
]

export const MOCK_RESO_OFFICES = [
  { OfficeKey: 'OFF-001', OfficeName: 'Royal LePage Urban Realty',       OfficeEmail: 'info@royallepage.ca' },
  { OfficeKey: 'OFF-002', OfficeName: 'RE/MAX Hallmark Realty',          OfficeEmail: 'info@remax.ca'       },
  { OfficeKey: 'OFF-003', OfficeName: 'Sotheby\'s International Realty', OfficeEmail: 'info@sothebys.ca'   },
  { OfficeKey: 'OFF-004', OfficeName: 'Keller Williams Referred Urban',  OfficeEmail: 'info@kw.ca'          },
  { OfficeKey: 'OFF-005', OfficeName: 'Century 21 Leading Edge',         OfficeEmail: 'info@c21.ca'         },
]
```

- [ ] **Step 2: Commit**

```bash
git add data/mock-reso-seed.ts
git commit -m "feat: add mock RESO seed data (60 GTA listings)"
```

---

## Chunk 2: Mock RESO API

### Task 3: OData filter parser

**Files:**
- Create: `lib/odata-filter.ts`

- [ ] **Step 1: Create `lib/odata-filter.ts`**

```typescript
export interface FilterClause {
  field: string
  op:    'eq' | 'ne' | 'gt' | 'ge' | 'lt' | 'le'
  value: string | number | boolean | null
}

const CLAUSE_RE = /^(\w+)\s+(eq|ne|gt|ge|lt|le)\s+(.+)$/i

function parseValue(raw: string): string | number | boolean | null {
  const s = raw.trim()
  if (s === 'null')  return null
  if (s === 'true')  return true
  if (s === 'false') return false
  if ((s.startsWith("'") && s.endsWith("'")) ||
      (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1)
  }
  const n = Number(s)
  if (!isNaN(n)) return n
  return s
}

export function parseODataFilter(filter: string): FilterClause[] {
  if (!filter?.trim()) return []
  const clauses = filter.split(/\s+and\s+/i)
  const result: FilterClause[] = []
  for (const clause of clauses) {
    const m = clause.trim().match(CLAUSE_RE)
    if (!m) {
      console.warn('[odata-filter] Unsupported clause:', clause)
      continue
    }
    result.push({ field: m[1], op: m[2].toLowerCase() as FilterClause['op'], value: parseValue(m[3]) })
  }
  return result
}

/** Apply parsed filter clauses to an in-memory array. */
export function applyFilter<T extends Record<string, unknown>>(items: T[], clauses: FilterClause[]): T[] {
  if (!clauses.length) return items
  return items.filter(item => clauses.every(({ field, op, value }) => {
    const v = item[field]
    if (v === undefined) return true // unknown field — don't filter
    switch (op) {
      case 'eq': return v == value
      case 'ne': return v != value
      case 'gt': return (v as number) >  (value as number)
      case 'ge': return (v as number) >= (value as number)
      case 'lt': return (v as number) <  (value as number)
      case 'le': return (v as number) <= (value as number)
    }
  }))
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | grep "odata-filter"
```

Expected: no errors for this file.

- [ ] **Step 3: Commit**

```bash
git add lib/odata-filter.ts
git commit -m "feat: add OData filter parser"
```

---

### Task 4: Mock RESO auth helper

**Files:**
- Create: `lib/mock-reso-auth.ts`

- [ ] **Step 1: Create `lib/mock-reso-auth.ts`**

The mock token is a base64url-encoded JSON payload `{sub, exp}` signed with HMAC-SHA256 using `RESO_TOKEN_SECRET`. We use the Web Crypto API (available in Node 18+ and Edge runtime) to keep zero extra dependencies.

```typescript
import { createHmac } from 'crypto'

const SECRET = process.env.RESO_TOKEN_SECRET ?? 'dev-reso-secret'

function toBase64Url(s: string): string {
  return Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function hmacSign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function createMockResoToken(): string {
  const payload = toBase64Url(JSON.stringify({ sub: 'mock-client', exp: Math.floor(Date.now() / 1000) + 3600 }))
  return `${payload}.${hmacSign(payload)}`
}

export function validateMockResoToken(request: Request): boolean {
  const auth = request.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return false
  const token = auth.slice(7)
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64').toString())
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return false
    // Simple string comparison is acceptable here — this is a mock for local dev only, not a security boundary
    return hmacSign(payload) === sig
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/mock-reso-auth.ts
git commit -m "feat: add mock RESO token helper"
```

---

### Task 5: Mock token endpoint

**Files:**
- Create: `app/api/mock-reso/token/route.ts`

- [ ] **Step 1: Create `app/api/mock-reso/token/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createMockResoToken } from '@/lib/mock-reso-auth'

export async function POST(request: Request) {
  const text = await request.text()
  const params = new URLSearchParams(text)

  const grantType    = params.get('grant_type')
  const clientId     = params.get('client_id')
  const clientSecret = params.get('client_secret')

  if (grantType !== 'client_credentials') {
    return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 })
  }
  if (clientId !== process.env.RESO_CLIENT_ID || clientSecret !== process.env.RESO_CLIENT_SECRET) {
    return NextResponse.json({ error: 'invalid_client' }, { status: 401 })
  }

  const access_token = createMockResoToken()
  return NextResponse.json({ access_token, token_type: 'Bearer', expires_in: 3600 })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/mock-reso/token/route.ts
git commit -m "feat: add mock RESO OAuth token endpoint"
```

---

### Task 6: Mock Property endpoints

**Files:**
- Create: `app/api/mock-reso/Property/route.ts`
- Create: `app/api/mock-reso/Property/[ListingKey]/route.ts`

- [ ] **Step 1: Create `app/api/mock-reso/Property/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { validateMockResoToken } from '@/lib/mock-reso-auth'
import { parseODataFilter, applyFilter } from '@/lib/odata-filter'
import { MOCK_RESO_LISTINGS } from '@/data/mock-reso-seed'

function applySelect(item: Record<string, unknown>, select: string): Record<string, unknown> {
  const fields = select.split(',').map(s => s.trim())
  return Object.fromEntries(fields.filter(f => f in item).map(f => [f, item[f]]))
}

function applyOrderBy(items: typeof MOCK_RESO_LISTINGS, orderby: string): typeof MOCK_RESO_LISTINGS {
  const [field, dir] = orderby.trim().split(/\s+/)
  return [...items].sort((a, b) => {
    const av = (a as Record<string, unknown>)[field]
    const bv = (b as Record<string, unknown>)[field]
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return dir?.toLowerCase() === 'desc' ? -cmp : cmp
  })
}

export async function GET(request: Request) {
  if (!validateMockResoToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const filter  = searchParams.get('$filter')  ?? ''
  const select  = searchParams.get('$select')  ?? ''
  const top     = Math.min(100, parseInt(searchParams.get('$top')  ?? '20', 10))
  const skip    = parseInt(searchParams.get('$skip') ?? '0', 10)
  const orderby = searchParams.get('$orderby') ?? ''

  const clauses = parseODataFilter(filter)
  let data: typeof MOCK_RESO_LISTINGS = applyFilter(MOCK_RESO_LISTINGS as unknown as Record<string, unknown>[], clauses) as typeof MOCK_RESO_LISTINGS

  if (orderby) data = applyOrderBy(data, orderby)

  const count = data.length
  const page  = data.slice(skip, skip + top)

  const value = select
    ? page.map(item => applySelect(item as unknown as Record<string, unknown>, select))
    : page

  return NextResponse.json({
    '@odata.context': `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/mock-reso/$metadata#Property`,
    '@odata.count':   count,
    value,
  })
}
```

- [ ] **Step 2: Create `app/api/mock-reso/Property/[ListingKey]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { validateMockResoToken } from '@/lib/mock-reso-auth'
import { MOCK_RESO_LISTINGS } from '@/data/mock-reso-seed'

interface Props { params: Promise<{ ListingKey: string }> }

export async function GET(request: Request, { params }: Props) {
  if (!validateMockResoToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { ListingKey } = await params
  const listing = MOCK_RESO_LISTINGS.find(l => l.ListingKey === ListingKey)
  if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(listing)
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/mock-reso/Property/
git commit -m "feat: add mock RESO Property endpoints with OData support"
```

---

### Task 7: Mock Member + Office endpoints

**Files:**
- Create: `app/api/mock-reso/Member/route.ts`
- Create: `app/api/mock-reso/Office/route.ts`

- [ ] **Step 1: Create `app/api/mock-reso/Member/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { validateMockResoToken } from '@/lib/mock-reso-auth'
import { MOCK_RESO_MEMBERS } from '@/data/mock-reso-seed'

export async function GET(request: Request) {
  if (!validateMockResoToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    '@odata.context': `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/mock-reso/$metadata#Member`,
    '@odata.count':   MOCK_RESO_MEMBERS.length,
    value: MOCK_RESO_MEMBERS,
  })
}
```

- [ ] **Step 2: Create `app/api/mock-reso/Office/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { validateMockResoToken } from '@/lib/mock-reso-auth'
import { MOCK_RESO_OFFICES } from '@/data/mock-reso-seed'

export async function GET(request: Request) {
  if (!validateMockResoToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    '@odata.context': `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/mock-reso/$metadata#Office`,
    '@odata.count':   MOCK_RESO_OFFICES.length,
    value: MOCK_RESO_OFFICES,
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/mock-reso/Member/route.ts app/api/mock-reso/Office/route.ts
git commit -m "feat: add mock RESO Member and Office endpoints"
```

---

## Chunk 3: RESO Service Layer

### Task 8: RESO types

**Files:**
- Create: `services/reso/types.ts`

- [ ] **Step 1: Create `services/reso/types.ts`**

```typescript
export interface ResoPropertyRaw {
  ListingKey:            string
  ListingId?:            string
  StandardStatus:        string
  PropertyType?:         string
  PropertySubType?:      string
  ListPrice?:            number
  OriginalListPrice?:    number
  ClosePrice?:           number
  BedroomsTotal?:        number
  BathroomsTotalInteger?: number
  LivingArea?:           number
  LotSizeAcres?:         number
  YearBuilt?:            number
  StreetNumber?:         string
  StreetName?:           string
  UnitNumber?:           string
  City?:                 string
  StateOrProvince?:      string
  PostalCode?:           string
  Latitude?:             number
  Longitude?:            number
  PublicRemarks?:        string
  Media?:                { url: string; order: number }[]
  ListAgentKey?:         string
  ListAgentFullName?:    string
  ListOfficeKey?:        string
  ListOfficeName?:       string
  ListingContractDate?:  string
  ModificationTimestamp?: string
}

export interface ResoMemberRaw {
  MemberKey:      string
  MemberFullName: string
  MemberEmail?:   string
  OfficeKey?:     string
}

export interface ResoOfficeRaw {
  OfficeKey:   string
  OfficeName:  string
  OfficeEmail?: string
}

export interface ResoODataResponse<T> {
  '@odata.context'?: string
  '@odata.count'?:   number
  value:             T[]
}

export interface ResoSyncResult {
  added:     number
  updated:   number
  removed:   number
  errors:    string[]
  durationMs: number
}
```

- [ ] **Step 2: Commit**

```bash
git add services/reso/types.ts
git commit -m "feat: add RESO type definitions"
```

---

### Task 9: RESO client

**Files:**
- Create: `services/reso/client.ts`

- [ ] **Step 1: Create `services/reso/client.ts`**

```typescript
import type { ResoODataResponse } from './types'

const BASE_URL       = process.env.RESO_API_BASE_URL   ?? 'http://localhost:3000/api/mock-reso'
const CLIENT_ID      = process.env.RESO_CLIENT_ID      ?? 'mock-client'
const CLIENT_SECRET  = process.env.RESO_CLIENT_SECRET  ?? 'mock-secret'

interface TokenCache {
  token:     string
  expiresAt: number   // unix ms
}

let tokenCache: TokenCache | null = null

async function getToken(): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.token
  }

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
  })

  const res = await fetch(`${BASE_URL}/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`RESO token request failed: ${res.status} ${text}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  tokenCache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 }
  return data.access_token
}

export type ODataParams = {
  $filter?:  string
  $select?:  string
  $top?:     number
  $skip?:    number
  $orderby?: string
}

export async function resoGet<T>(resource: string, params: ODataParams = {}): Promise<ResoODataResponse<T>> {
  const token = await getToken()
  const qs = new URLSearchParams()
  if (params.$filter)  qs.set('$filter',  params.$filter)
  if (params.$select)  qs.set('$select',  params.$select)
  if (params.$top  != null) qs.set('$top',    String(params.$top))
  if (params.$skip != null) qs.set('$skip',   String(params.$skip))
  if (params.$orderby) qs.set('$orderby', params.$orderby)

  const url = `${BASE_URL}/${resource}?${qs}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next:    { revalidate: 0 },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`RESO API error: ${res.status} ${url} — ${text}`)
  }

  return res.json() as Promise<ResoODataResponse<T>>
}

/** Fetch all pages of a resource using @odata.count for termination. */
export async function resoGetAll<T>(resource: string, filter?: string): Promise<T[]> {
  const PAGE_SIZE = 100
  let skip = 0
  const all: T[] = []

  // Fetch first page to get total count
  const first = await resoGet<T>(resource, {
    $filter:  filter,
    $top:     PAGE_SIZE,
    $skip:    0,
    $orderby: 'ModificationTimestamp desc',
  })
  all.push(...first.value)
  const total = first['@odata.count'] ?? first.value.length
  skip = PAGE_SIZE

  while (skip < total) {
    const response = await resoGet<T>(resource, {
      $filter:  filter,
      $top:     PAGE_SIZE,
      $skip:    skip,
      $orderby: 'ModificationTimestamp desc',
    })
    all.push(...response.value)
    if (response.value.length === 0) break // safety guard
    skip += PAGE_SIZE
  }

  return all
}
```

- [ ] **Step 2: Commit**

```bash
git add services/reso/client.ts
git commit -m "feat: add RESO API client with OAuth token management"
```

---

### Task 10: RESO sync service

**Files:**
- Create: `services/reso/sync.ts`

- [ ] **Step 1: Create `services/reso/sync.ts`**

```typescript
import { prisma } from '@/lib/prisma'
import { resoGetAll } from './client'
import type { ResoPropertyRaw, ResoSyncResult } from './types'

export async function syncResoListings(): Promise<ResoSyncResult> {
  const start  = Date.now()
  const result: ResoSyncResult = { added: 0, updated: 0, removed: 0, errors: [], durationMs: 0 }

  try {
    const raw = await resoGetAll<ResoPropertyRaw>('Property', "StandardStatus eq 'Active'")
    const incomingKeys = new Set(raw.map(r => r.ListingKey))

    for (const r of raw) {
      try {
        const data = {
          listingKey:            r.ListingKey,
          listingId:             r.ListingId             ?? null,
          standardStatus:        r.StandardStatus,
          propertyType:          r.PropertyType          ?? null,
          propertySubType:       r.PropertySubType       ?? null,
          listPrice:             r.ListPrice             ?? null,
          originalListPrice:     r.OriginalListPrice     ?? null,
          closePrice:            r.ClosePrice            ?? null,
          bedroomsTotal:         r.BedroomsTotal         ?? null,
          bathroomsTotalInteger: r.BathroomsTotalInteger ?? null,
          livingArea:            r.LivingArea            ?? null,
          lotSizeAcres:          r.LotSizeAcres          ?? null,
          yearBuilt:             r.YearBuilt             ?? null,
          streetNumber:          r.StreetNumber          ?? null,
          streetName:            r.StreetName            ?? null,
          unitNumber:            r.UnitNumber            ?? null,
          city:                  r.City                  ?? null,
          stateOrProvince:       r.StateOrProvince       ?? null,
          postalCode:            r.PostalCode            ?? null,
          latitude:              r.Latitude              ?? null,
          longitude:             r.Longitude             ?? null,
          publicRemarks:         r.PublicRemarks         ?? null,
          media:                 r.Media ? JSON.stringify(r.Media) : null,
          listAgentKey:          r.ListAgentKey          ?? null,
          listAgentName:         r.ListAgentFullName     ?? null,
          listOfficeKey:         r.ListOfficeKey         ?? null,
          listOfficeName:        r.ListOfficeName        ?? null,
          listDate:              r.ListingContractDate   ? new Date(r.ListingContractDate) : null,
          modificationTimestamp: r.ModificationTimestamp ? new Date(r.ModificationTimestamp) : null,
          lastSyncedAt:          new Date(),
          rawData:               JSON.stringify(r),
        }

        const existing = await prisma.resoProperty.findUnique({ where: { listingKey: r.ListingKey } })
        if (existing) {
          await prisma.resoProperty.update({ where: { listingKey: r.ListingKey }, data })
          result.updated++
        } else {
          await prisma.resoProperty.create({ data })
          result.added++
        }
      } catch (e) {
        result.errors.push(`${r.ListingKey}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // Mark listings no longer in feed as Closed
    const active   = await prisma.resoProperty.findMany({ where: { standardStatus: 'Active' }, select: { listingKey: true } })
    const toRemove = active.filter(p => !incomingKeys.has(p.listingKey))
    if (toRemove.length > 0) {
      await prisma.resoProperty.updateMany({
        where: { listingKey: { in: toRemove.map(p => p.listingKey) } },
        data:  { standardStatus: 'Closed' },
      })
      result.removed = toRemove.length
    }
  } catch (e) {
    result.errors.push(`Sync failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  result.durationMs = Date.now() - start

  await prisma.resoSyncLog.create({
    data: {
      added:    result.added,
      updated:  result.updated,
      removed:  result.removed,
      errors:   result.errors.length ? result.errors.join('\n') : null,
      duration: result.durationMs,
    },
  })

  return result
}
```

- [ ] **Step 2: Commit**

```bash
git add services/reso/sync.ts
git commit -m "feat: add RESO sync service"
```

---

### Task 11: RESO sync API route

**Files:**
- Create: `app/api/reso/sync/route.ts`

- [ ] **Step 1: Create `app/api/reso/sync/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { syncResoListings } from '@/services/reso/sync'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret !== process.env.RESO_SYNC_SECRET) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await syncResoListings()
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json({ error: 'Sync failed', details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [lastSync, activeCount] = await Promise.all([
    prisma.resoSyncLog.findFirst({ orderBy: { syncedAt: 'desc' } }),
    prisma.resoProperty.count({ where: { standardStatus: 'Active' } }),
  ])
  return NextResponse.json({ lastSync, activeListings: activeCount })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/reso/sync/route.ts
git commit -m "feat: add RESO sync API route"
```

---

## Chunk 4: PropertyService & Cache

### Task 12: Cache helper

**Files:**
- Create: `lib/cache.ts`

- [ ] **Step 1: Install lru-cache**

```bash
npm install lru-cache
```

- [ ] **Step 2: Create `lib/cache.ts`**

```typescript
import { LRUCache } from 'lru-cache'

// No default TTL — each call to withCache() specifies its own TTL.
// Set ttlAutopurge: true so expired entries are cleaned up automatically.
const cache = new LRUCache<string, unknown>({
  max:          500,
  ttlAutopurge: true,
})

export async function withCache<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as T | undefined
  if (hit !== undefined) return hit
  const value = await fn()
  cache.set(key, value, { ttl: ttlSeconds * 1000 })
  return value
}

export function invalidateCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/cache.ts package.json package-lock.json
git commit -m "feat: add LRU cache helper"
```

---

### Task 13: PropertyService

**Files:**
- Create: `lib/property-service.ts`

- [ ] **Step 1: Create `lib/property-service.ts`**

```typescript
import { prisma } from '@/lib/prisma'
import { withCache } from '@/lib/cache'
import type { ResoProperty } from '@prisma/client'

export interface PropertyFilters {
  city?:         string
  minPrice?:     number
  maxPrice?:     number
  minBeds?:      number
  minBaths?:     number
  propertyType?: string
  status?:       string   // default: 'Active'
  page?:         number   // default: 1
  pageSize?:     number   // default: 20
}

export interface PropertyListResult {
  listings:   ResoProperty[]
  total:      number
  page:       number
  pageSize:   number
  totalPages: number
}

function buildCacheKey(filters: PropertyFilters): string {
  const parts = Object.entries(filters)
    .filter(([, v]) => v != null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
  return `properties:${parts.join(':')}`
}

function buildWhere(filters: PropertyFilters) {
  const where: Record<string, unknown> = {
    standardStatus: filters.status ?? 'Active',
  }
  if (filters.city) {
    // SQLite: contains is already case-insensitive by default.
    // MySQL: requires mode: 'insensitive' for case-insensitive contains.
    const isMySQL = process.env.DATABASE_URL?.includes('mysql')
    where.city = isMySQL
      ? { contains: filters.city, mode: 'insensitive' }
      : { contains: filters.city }
  }
  if (filters.minPrice != null || filters.maxPrice != null) {
    where.listPrice = {
      ...(filters.minPrice != null ? { gte: filters.minPrice } : {}),
      ...(filters.maxPrice != null ? { lte: filters.maxPrice } : {}),
    }
  }
  if (filters.minBeds != null)  where.bedroomsTotal         = { gte: filters.minBeds }
  if (filters.minBaths != null) where.bathroomsTotalInteger = { gte: filters.minBaths }
  if (filters.propertyType)     where.propertySubType       = { contains: filters.propertyType }
  return where
}

export const PropertyService = {
  async getProperties(filters: PropertyFilters = {}): Promise<PropertyListResult> {
    const page     = Math.max(1, filters.page     ?? 1)
    const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20))
    const skip     = (page - 1) * pageSize
    const cacheKey = buildCacheKey({ ...filters, page, pageSize })

    return withCache(cacheKey, 60, async () => {
      const where = buildWhere(filters)
      const [total, listings] = await Promise.all([
        prisma.resoProperty.count({ where }),
        prisma.resoProperty.findMany({
          where,
          orderBy: { listDate: 'desc' },
          skip,
          take: pageSize,
        }),
      ])
      return { listings, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
    })
  },

  async getProperty(key: string): Promise<ResoProperty | null> {
    // `key` may be a listingKey (e.g. "TRREB-1001234") or a cuid `id`.
    // Try listingKey first (the canonical identifier for RESO properties),
    // then fall back to id for backwards compatibility.
    return withCache(`property:${key}`, 60, async () => {
      const byListingKey = await prisma.resoProperty.findUnique({ where: { listingKey: key } })
      if (byListingKey) return byListingKey
      return prisma.resoProperty.findUnique({ where: { id: key } })
    })
  },
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep "property-service"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/property-service.ts
git commit -m "feat: add PropertyService abstraction over ResoProperty"
```

---

## Chunk 5: Update Existing Code

### Task 14: Update search engine for RESO

The existing `services/search/engine.ts` has an "idx" source path that queries `idxProperty`. Replace it with a "reso" source path that queries `ResoProperty` via `PropertyService`. Also update `services/search/filters.ts`.

**Files:**
- Modify: `services/search/engine.ts`
- Modify: `services/search/filters.ts` (remove `buildIdxWhere`)
- Modify: `services/search/types.ts` (update source type)

- [ ] **Step 1: Read `services/search/types.ts`**

```bash
cat services/search/types.ts
```

- [ ] **Step 2: Update `services/search/types.ts`**

**2a.** Find the `source` field in `SearchFilters` interface:

Find: `source?: 'all' | 'manual' | 'idx'`
Replace with: `source?: 'all' | 'manual' | 'reso'`

**2b.** Add `listingKey` to the `SearchResult` interface. Open `services/search/types.ts`, find the `SearchResult` interface, and add the `listingKey` field after `id`:

Find the line `id: string` inside `SearchResult` and add after it:
```typescript
listingKey?: string   // RESO listingKey (e.g. "TRREB-1001234"); undefined for manual Property results
```

**2c.** Also update `source` field inside `SearchResult` if it has `'idx'`:

Find: `source: 'manual' | 'idx'`
Replace with: `source: 'manual' | 'reso'`

- [ ] **Step 3: Replace the `idx` block in `services/search/engine.ts`**

Find the block starting `if (source === 'idx' || source === 'all')` through its closing `}` and replace with:

```typescript
  if (source === 'reso' || source === 'all') {
    const { PropertyService } = await import('@/lib/property-service')
    const resoResult = await PropertyService.getProperties({
      city:         filters.city,
      minPrice:     filters.minPrice,
      maxPrice:     filters.maxPrice,
      minBeds:      filters.minBeds,
      minBaths:     filters.minBaths,
      propertyType: filters.propertyType,
      page:         source === 'all' ? 1       : page,
      pageSize:     source === 'all' ? 9999    : pageSize,
    })

    const resoResults: SearchResult[] = resoResult.listings.map(p => ({
      id:          p.id,
      listingKey:  p.listingKey,
      source:      'reso' as const,
      title:       [p.streetNumber, p.streetName, p.unitNumber].filter(Boolean).join(' ') || p.listingKey,
      price:       p.listPrice,
      bedrooms:    p.bedroomsTotal,
      bathrooms:   p.bathroomsTotalInteger,
      sqft:        p.livingArea ? Math.round(p.livingArea) : null,
      address:     [p.streetNumber, p.streetName].filter(Boolean).join(' '),
      city:        p.city,
      propertyType: p.propertySubType,
      listingType:  'sale',
      images:       p.media ? (JSON.parse(p.media) as { url: string }[]).map(m => m.url) : [],
      latitude:     p.latitude,
      longitude:    p.longitude,
    }))

    results = [...results, ...resoResults]
    total  += resoResult.total
  }
```

- [ ] **Step 4: Remove `buildIdxWhere` from `services/search/filters.ts`**

Open `services/search/filters.ts`. Delete the `buildIdxWhere` function and its export entirely.

- [ ] **Step 4b: Update the `source === 'all'` deduplication block in `services/search/engine.ts`**

The existing engine has a dedup/slice block after both sources are combined. Find it (it looks like `if (source === 'all') { total = results.length; results = results.slice(...) }`) and replace with:

```typescript
  // If combined: deduplicate by address, then paginate in memory
  if (source === 'all') {
    const seen = new Set<string>()
    results = results.filter(r => {
      const key = `${r.city ?? ''}:${r.address ?? ''}`.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    total = results.length
    results = results.slice(skip, skip + pageSize)
  }
```

- [ ] **Step 5: Remove the import of `buildIdxWhere`** from the top of `services/search/engine.ts`:

Find: `import { buildPropertyWhere, buildIdxWhere, buildOrderBy } from './filters'`
Replace with: `import { buildPropertyWhere, buildOrderBy } from './filters'`

- [ ] **Step 6: Type check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only about `idxProperty` references in files not yet updated.

- [ ] **Step 7: Commit**

```bash
git add services/search/
git commit -m "feat: replace idxProperty with ResoProperty in search engine"
```

---

### Task 15: Update listing detail page

Replace the `prisma.property.findUnique` call and all `Property` field references with `PropertyService.getProperty` and RESO field names.

**Files:**
- Modify: `app/(public)/listings/[id]/page.tsx`

- [ ] **Step 1: Replace `app/(public)/listings/[id]/page.tsx` entirely**

```typescript
import { headers, cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { PropertyService } from '@/lib/property-service'
import { getGateSettings } from '@/lib/site-settings'
import { Container } from '@/components/layout'
import { PropertyGallery } from '@/components/real-estate'
import { PropertyInquiryForm } from '@/components/forms'
import { ListingGateModal } from '@/components/public/ListingGateModal'
import { Badge } from '@/components/ui'
import { formatPrice, parseJsonSafe } from '@/lib/utils'
import { Bed, Bath, Square, MapPin, Calendar, Car } from 'lucide-react'
import type { Metadata } from 'next'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const property = await PropertyService.getProperty(id)
  if (!property) return {}
  const address = [property.streetNumber, property.streetName, property.city].filter(Boolean).join(' ')
  return {
    title: address || property.listingKey,
    description: property.publicRemarks ?? undefined,
  }
}

export default async function ListingDetailPage({ params }: Props) {
  const { id } = await params
  const property = await PropertyService.getProperty(id)
  if (!property) notFound()

  // ── Gate decision ──────────────────────────────────────────────────────────
  const reqHeaders  = await headers()
  const isBypass    = reqHeaders.get('x-gate-bypass')  === 'true'
  const isPending   = reqHeaders.get('x-gate-pending') === 'true'
  const viewCount   = parseInt(reqHeaders.get('x-view-count') ?? '0', 10)
  const { limit, enabled } = await getGateSettings()
  const showGate    = enabled && !isBypass && !isPending && viewCount >= limit
  const showPending = enabled && !isBypass && isPending

  // ── Track view for verified contacts ──────────────────────────────────────
  if (isBypass) {
    const cookieStore = await cookies()
    const contactId   = cookieStore.get('re_verified')?.value
    const sessionId   = reqHeaders.get('x-session-id') ?? undefined
    if (contactId) {
      const { trackBehaviorEvent } = await import('@/services/ai/lead-scoring')
      void trackBehaviorEvent('listing_view', property.id, contactId, sessionId, undefined).catch(() => null)
      const { prisma } = await import('@/lib/prisma')
      void prisma.contactPropertyInterest.upsert({
        where:  { contactId_resoPropertyId: { contactId, resoPropertyId: property.id } },
        update: { updatedAt: new Date() },
        create: { contactId, resoPropertyId: property.id, source: 'auto' },
      }).catch(() => null)
    }
  }

  const mediaItems = parseJsonSafe<{ url: string; order: number }[]>(property.media, [])
  const images     = mediaItems.length > 0 ? mediaItems.map(m => m.url) : ['/placeholder-property.jpg']
  const address    = [property.streetNumber, property.streetName, property.unitNumber ? `#${property.unitNumber}` : null].filter(Boolean).join(' ')
  const returnUrl  = `/listings/${id}`

  return (
    <div className="pt-20">
      {(showGate || showPending) && (
        <ListingGateModal
          initialState={showPending ? 'pending' : 'gate'}
          returnUrl={returnUrl}
        />
      )}

      <div className={showGate || showPending ? 'blur-sm pointer-events-none select-none' : ''}>
        <Container className="py-8">
          <PropertyGallery images={images} title={address} />

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-serif text-4xl font-bold text-charcoal-900">
                    {formatPrice(property.listPrice ?? 0)}
                  </p>
                  <h1 className="text-xl font-semibold text-charcoal-700 mt-1">{address}</h1>
                  <p className="flex items-center gap-1.5 text-charcoal-500 mt-1">
                    <MapPin size={15} /> {property.city}, {property.stateOrProvince} {property.postalCode}
                  </p>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Badge variant={property.standardStatus === 'Active' ? 'success' : 'warning'} className="capitalize">
                    {property.standardStatus}
                  </Badge>
                  {property.propertySubType && (
                    <Badge variant="default" className="capitalize">{property.propertySubType}</Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-6 py-5 border-y border-charcoal-100 mb-6">
                {property.bedroomsTotal         != null && <span className="flex items-center gap-2 text-charcoal-700"><Bed    size={18} /> <strong>{property.bedroomsTotal}</strong> Bedrooms</span>}
                {property.bathroomsTotalInteger != null && <span className="flex items-center gap-2 text-charcoal-700"><Bath   size={18} /> <strong>{property.bathroomsTotalInteger}</strong> Bathrooms</span>}
                {property.livingArea            != null && <span className="flex items-center gap-2 text-charcoal-700"><Square size={18} /> <strong>{Math.round(property.livingArea).toLocaleString()}</strong> sqft</span>}
                {property.yearBuilt             != null && <span className="flex items-center gap-2 text-charcoal-700"><Calendar size={18} /> Built <strong>{property.yearBuilt}</strong></span>}
              </div>

              {property.publicRemarks && (
                <div className="mb-8">
                  <h2 className="font-serif text-2xl font-bold text-charcoal-900 mb-3">About This Property</h2>
                  <p className="text-charcoal-600 leading-relaxed whitespace-pre-wrap">{property.publicRemarks}</p>
                </div>
              )}

              {(property.listAgentName || property.listOfficeName) && (
                <div className="mb-8 p-4 rounded-xl bg-charcoal-50 border border-charcoal-100">
                  <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-1">Listed By</p>
                  {property.listAgentName  && <p className="text-sm font-medium text-charcoal-900">{property.listAgentName}</p>}
                  {property.listOfficeName && <p className="text-sm text-charcoal-500">{property.listOfficeName}</p>}
                </div>
              )}
            </div>

            <div>
              <PropertyInquiryForm
                propertyId={property.id}
                propertyAddress={address}
              />
            </div>
          </div>
        </Container>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | grep "listings/\[id\]"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/listings/[id]/page.tsx"
git commit -m "feat: update listing detail page to use PropertyService + RESO fields"
```

---

### Task 16: Update behavior API route

**Files:**
- Modify: `app/api/behavior/route.ts`

- [ ] **Step 1: Replace the ContactPropertyInterest upsert in `app/api/behavior/route.ts`**

Find this block:
```typescript
    if (data.eventType === 'listing_view' && data.contactId && data.entityId) {
      await prisma.contactPropertyInterest.upsert({
        where:  { contactId_propertyId: { contactId: data.contactId, propertyId: data.entityId } },
        update: { updatedAt: new Date() },
        create: { contactId: data.contactId, propertyId: data.entityId, source: 'auto' },
      })
    }
```

Replace with:
```typescript
    if (data.eventType === 'listing_view' && data.contactId && data.entityId) {
      await prisma.contactPropertyInterest.upsert({
        where:  { contactId_resoPropertyId: { contactId: data.contactId, resoPropertyId: data.entityId } },
        update: { updatedAt: new Date() },
        create: { contactId: data.contactId, resoPropertyId: data.entityId, source: 'auto' },
      })
    }
```

- [ ] **Step 2: Commit**

```bash
git add app/api/behavior/route.ts
git commit -m "fix: update behavior route to use resoPropertyId in ContactPropertyInterest"
```

---

### Task 17: Update property-interests API routes

These routes were built in the previous feature (listing interest tracking). Update them for the new `resoPropertyId` field.

**Files:**
- Modify: `app/api/contacts/[id]/property-interests/route.ts`
- Modify: `app/api/contacts/[id]/property-interests/[propertyId]/route.ts`
- Modify: `app/api/listings/[id]/assign-contact/route.ts`
- Modify: `components/admin/contacts/PropertyInterestsPanel.tsx`

- [ ] **Step 1: Read each file**

```bash
cat app/api/contacts/[id]/property-interests/route.ts
cat "app/api/contacts/[id]/property-interests/[propertyId]/route.ts"
cat app/api/listings/[id]/assign-contact/route.ts
```

- [ ] **Step 2: In `app/api/contacts/[id]/property-interests/route.ts`**

Find all occurrences of `propertyId` used as the FK field on `contactPropertyInterest` (not the URL param) and rename them to `resoPropertyId`. Also update the `@@unique` constraint reference:

- `contactId_propertyId` → `contactId_resoPropertyId`
- `propertyId: ...` (in create/where) → `resoPropertyId: ...`
- Any `include: { property: true }` → `include: { resoProperty: true }`

The `propertyId` URL route parameter variable name can stay as-is (it's a local variable, not a DB field).

- [ ] **Step 3: In `app/api/contacts/[id]/property-interests/[propertyId]/route.ts`**

Same substitutions: `contactId_propertyId` → `contactId_resoPropertyId`, `propertyId:` → `resoPropertyId:` in the Prisma where clause.

- [ ] **Step 4: In `app/api/listings/[id]/assign-contact/route.ts`**

Find the `contactPropertyInterest.create` or `upsert` call and update:
- `propertyId:` → `resoPropertyId:`
- `contactId_propertyId:` → `contactId_resoPropertyId:`

Note: the listing ID passed here should be the `ResoProperty.id` (cuid), which is what `property.id` returns from `PropertyService.getProperty`. Verify the route is finding the property by `listingKey` (the route param `[id]`). If it's currently doing `prisma.property.findUnique({ where: { id } })`, change to:
```typescript
const resoProperty = await prisma.resoProperty.findUnique({ where: { listingKey: id } })
  ?? await prisma.resoProperty.findUnique({ where: { id } })
```
This handles both `listingKey` and `id` lookups for compatibility.

- [ ] **Step 5: In `components/admin/contacts/PropertyInterestsPanel.tsx`**

Update all field references from the old `Property` model to `ResoProperty` fields:
- `property.title` → `[p.streetNumber, p.streetName].filter(Boolean).join(' ') || p.resoProperty.listingKey`
- `property.price` → `p.resoProperty.listPrice`
- `property.propertyType` → `p.resoProperty.propertySubType`
- `property.city` → `p.resoProperty.city`
- Images: `parseJsonSafe(p.resoProperty.media, [])` then `.map(m => m.url)[0]`

The `include: { property: true }` in the GET endpoint should now be `include: { resoProperty: true }`.

- [ ] **Step 6: Type check**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Fix any remaining type errors from the FK rename.

- [ ] **Step 7: Commit**

```bash
git add app/api/contacts/ app/api/listings/ components/admin/contacts/PropertyInterestsPanel.tsx
git commit -m "fix: update property-interests routes and panel for resoPropertyId FK rename"
```

---

### Task 18: Update admin settings page

**Files:**
- Modify: `app/admin/settings/page.tsx`

- [ ] **Step 1: In `app/admin/settings/page.tsx`**, find the IDX sync widget section

Replace:
```typescript
prisma.idxUpdate.findFirst({ orderBy: { syncedAt: 'desc' } }),
```
With:
```typescript
prisma.resoSyncLog.findFirst({ orderBy: { syncedAt: 'desc' } }),
```

Find the variable name (e.g. `lastSync`) and update the display text if it mentions "IDX":

Find: `Last synced: ...`
Update to keep the same format but the variable is now from `resoSyncLog`.

Find the Sync button form:
```html
<form action="/api/idx/sync" method="POST">
```
Replace with:
```html
<form action="/api/reso/sync" method="POST">
```

Find any heading that says "IDX Integration" and update to "RESO / IDX Sync".

- [ ] **Step 2: Commit**

```bash
git add app/admin/settings/page.tsx
git commit -m "fix: update admin settings to use ResoSyncLog and /api/reso/sync"
```

---

### Task 19: Delete old IDX files + update env vars

**Files:**
- Delete: `services/idx/client.ts`, `services/idx/parser.ts`, `services/idx/sync.ts`, `services/idx/types.ts`
- Delete: `app/api/idx/sync/route.ts`
- Modify: `.env.example`, `.env`

- [ ] **Step 1: Delete old files**

```bash
rm services/idx/client.ts services/idx/parser.ts services/idx/sync.ts services/idx/types.ts
rmdir services/idx
rm app/api/idx/sync/route.ts
rmdir app/api/idx/sync
rmdir app/api/idx
```

- [ ] **Step 2: Update `.env.example`**

Remove:
```
IDX_API_BASE_URL=https://api.idx.broker/api/1.7
IDX_API_KEY=
```

Add:
```
# ─── RESO / PropTx ────────────────────────────────────────────────────────────
# For local dev, mock RESO API runs inside Next.js — no external service needed.
# To use real PropTx: set RESO_API_BASE_URL to PropTx endpoint + real credentials.
RESO_API_BASE_URL=http://localhost:3000/api/mock-reso
RESO_CLIENT_ID=mock-client
RESO_CLIENT_SECRET=mock-secret
RESO_TOKEN_SECRET=change-me-in-production
RESO_SYNC_SECRET=change-me-in-production
```

- [ ] **Step 3: Update `.env`** with the same RESO vars (keep existing values for other vars).

- [ ] **Step 4: Type check — should be clean now**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing unrelated errors).

- [ ] **Step 5: Commit**

```bash
git add .env.example .env
git rm services/idx/client.ts services/idx/parser.ts services/idx/sync.ts services/idx/types.ts
git rm app/api/idx/sync/route.ts
git commit -m "feat: remove IDX Broker files, add RESO env vars"
```

---

### Task 20: Run initial sync

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Trigger sync** (in a new terminal)

```bash
curl -X POST http://localhost:3000/api/reso/sync \
  -H "x-cron-secret: change-me-in-production"
```

Expected response: `{"success":true,"result":{"added":25,"updated":0,"removed":0,"errors":[],...}}`

(Only Active listings are synced — ~48 of the 60 seed listings are Active.)

- [ ] **Step 3: Verify listings page** — open `http://localhost:3000/listings` and confirm properties appear.

- [ ] **Step 4: Verify listing detail page** — click a property, confirm gate logic works, RESO fields display correctly.

---

## Chunk 6: Saved Searches

### Task 21: Public saved search API routes

**Files:**
- Create: `app/api/saved-searches/route.ts`
- Create: `app/api/saved-searches/[id]/route.ts`

- [ ] **Step 1: Create `app/api/saved-searches/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

async function getContactId(): Promise<string | null> {
  const store = await cookies()
  return store.get('re_verified')?.value ?? null
}

const saveSchema = z.object({
  name:    z.string().optional(),
  filters: z.record(z.unknown()),
})

export async function GET() {
  const contactId = await getContactId()
  if (!contactId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const searches = await prisma.savedSearch.findMany({
    where:   { contactId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ searches })
}

export async function POST(request: Request) {
  const contactId = await getContactId()
  if (!contactId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await request.json()
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const search = await prisma.savedSearch.create({
    data: {
      contactId,
      name:    parsed.data.name ?? null,
      filters: JSON.stringify(parsed.data.filters),
    },
  })
  return NextResponse.json({ search }, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/saved-searches/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

interface Props { params: Promise<{ id: string }> }

async function getContactId(): Promise<string | null> {
  const store = await cookies()
  return store.get('re_verified')?.value ?? null
}

export async function DELETE(_req: Request, { params }: Props) {
  const contactId = await getContactId()
  if (!contactId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const search = await prisma.savedSearch.findUnique({ where: { id } })
  if (!search || search.contactId !== contactId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  await prisma.savedSearch.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/saved-searches/
git commit -m "feat: add public saved search API routes"
```

---

### Task 22: Admin saved search API routes

**Files:**
- Create: `app/api/contacts/[id]/saved-searches/route.ts`
- Create: `app/api/contacts/[id]/saved-searches/[searchId]/route.ts`

- [ ] **Step 1: Create `app/api/contacts/[id]/saved-searches/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

interface Props { params: Promise<{ id: string }> }

const createSchema = z.object({
  name:    z.string().optional(),
  filters: z.record(z.unknown()),
})

export async function GET(_req: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contactId } = await params
  const searches = await prisma.savedSearch.findMany({
    where:   { contactId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ searches })
}

export async function POST(request: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contactId } = await params
  const body   = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const search = await prisma.savedSearch.create({
    data: {
      contactId,
      name:    parsed.data.name ?? null,
      filters: JSON.stringify(parsed.data.filters),
    },
  })
  return NextResponse.json({ search }, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/contacts/[id]/saved-searches/[searchId]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Props { params: Promise<{ id: string; searchId: string }> }

export async function DELETE(_req: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchId } = await params
  const search = await prisma.savedSearch.findUnique({ where: { id: searchId } })
  if (!search) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.savedSearch.delete({ where: { id: searchId } })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/api/contacts/[id]/saved-searches/"
git commit -m "feat: add admin saved search API routes"
```

---

### Task 23: SaveSearchButton component

**Files:**
- Create: `components/public/SaveSearchButton.tsx`

- [ ] **Step 1: Create `components/public/SaveSearchButton.tsx`**

This is a client component. It reads the current URL search params to get filters, and POSTs to `/api/saved-searches`.

```typescript
'use client'

import { useState } from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'

interface Props {
  filters:     Record<string, string>
  searchName?: string
}

export function SaveSearchButton({ filters, searchName }: Props) {
  const [saved,   setSaved]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSave() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/saved-searches', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: searchName, filters }),
      })
      if (res.status === 401) {
        setError('Verify your email first to save searches.')
        return
      }
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
    } catch {
      setError('Could not save search. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (saved) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-gold-600 font-medium">
        <BookmarkCheck size={16} /> Search saved
      </span>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleSave}
        disabled={loading}
        className="flex items-center gap-1.5 text-sm text-charcoal-500 hover:text-gold-600 transition-colors disabled:opacity-50"
      >
        <Bookmark size={16} /> {loading ? 'Saving…' : 'Save this search'}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/public/SaveSearchButton.tsx
git commit -m "feat: add SaveSearchButton component"
```

---

### Task 24: Update public listings page

Add the `SaveSearchButton` to the existing listings page and thread `listingKey` through to the property card links.

**Files:**
- Modify: `app/(public)/listings/page.tsx`

- [ ] **Step 1: Add `SaveSearchButton` import to `app/(public)/listings/page.tsx`**

Add at the top of the file (after existing imports):
```typescript
import { SaveSearchButton } from '@/components/public/SaveSearchButton'
```

- [ ] **Step 2: Add `SaveSearchButton` to the results header**

Find the results header div:
```typescript
<p className="text-charcoal-600"><strong className="text-charcoal-900">{total}</strong> properties found</p>
```

After this `<p>` tag, add:
```typescript
<SaveSearchButton
  filters={Object.fromEntries(
    Object.entries(activeFilters).filter(([, v]) => v !== '')
  )}
/>
```

- [ ] **Step 3: Update the `properties` mapping to include `listingKey`**

In the `properties` array mapping, add:
```typescript
listingKey: r.listingKey,
```

Then in the `PropertyGrid` component (or wherever the property card href is generated), ensure the link uses `listingKey` if present, falling back to `id`:

In the properties map, change `id: r.id` → ensure `id: r.listingKey ?? r.id` so the link `/listings/${id}` routes to the RESO detail page by `listingKey`.

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit 2>&1 | grep "listings/page"
```

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/listings/page.tsx"
git commit -m "feat: add SaveSearchButton to listings page, use listingKey for property links"
```

---

### Task 25: SavedSearchesTab component + contact profile wiring

**Files:**
- Create: `components/admin/contacts/SavedSearchesTab.tsx`
- Modify: `app/admin/contacts/[id]/page.tsx`

- [ ] **Step 1: Create `components/admin/contacts/SavedSearchesTab.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Trash2, ExternalLink, Search } from 'lucide-react'
import { Button } from '@/components/ui'
import { formatDate } from '@/lib/utils'

interface SavedSearch {
  id:        string
  name:      string | null
  filters:   string
  createdAt: string
  lastRunAt: string | null
}

interface Props { contactId: string }

function filtersToLabel(filtersJson: string): string {
  try {
    const f = JSON.parse(filtersJson) as Record<string, string>
    const parts: string[] = []
    if (f.city)        parts.push(f.city)
    if (f.minPrice)    parts.push(`$${Number(f.minPrice).toLocaleString()}+`)
    if (f.maxPrice)    parts.push(`up to $${Number(f.maxPrice).toLocaleString()}`)
    if (f.minBeds)     parts.push(`${f.minBeds}+ beds`)
    if (f.propertyType) parts.push(f.propertyType)
    return parts.length ? parts.join(' · ') : 'All listings'
  } catch {
    return 'Search'
  }
}

function filtersToQS(filtersJson: string): string {
  try {
    const f = JSON.parse(filtersJson) as Record<string, string>
    return new URLSearchParams(f).toString()
  } catch {
    return ''
  }
}

export function SavedSearchesTab({ contactId }: Props) {
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    fetch(`/api/contacts/${contactId}/saved-searches`)
      .then(r => r.json())
      .then(d => { setSearches(d.searches ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [contactId])

  async function handleDelete(id: string) {
    await fetch(`/api/contacts/${contactId}/saved-searches/${id}`, { method: 'DELETE' })
    setSearches(s => s.filter(x => x.id !== id))
  }

  if (loading) return <p className="text-sm text-charcoal-400 py-4">Loading saved searches…</p>

  if (searches.length === 0) {
    return (
      <div className="py-8 text-center">
        <Search size={32} className="mx-auto text-charcoal-200 mb-3" />
        <p className="text-sm text-charcoal-400">No saved searches yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {searches.map(s => (
        <div key={s.id} className="flex items-start justify-between gap-4 rounded-xl border border-charcoal-100 bg-charcoal-50 px-4 py-3">
          <div className="min-w-0">
            {s.name && <p className="text-sm font-semibold text-charcoal-900 truncate">{s.name}</p>}
            <p className="text-sm text-charcoal-600">{filtersToLabel(s.filters)}</p>
            <p className="text-xs text-charcoal-400 mt-0.5">
              Saved {formatDate(new Date(s.createdAt), { month: 'short', day: 'numeric', year: 'numeric' })}
              {s.lastRunAt && ` · Last run ${formatDate(new Date(s.lastRunAt), { month: 'short', day: 'numeric' })}`}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="ghost" size="sm" asChild>
              <a href={`/listings?${filtersToQS(s.filters)}`} target="_blank" rel="noreferrer">
                <ExternalLink size={14} />
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}>
              <Trash2 size={14} className="text-red-400" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Add `SavedSearchesTab` to `app/admin/contacts/[id]/page.tsx`**

Add import at the top:
```typescript
import { SavedSearchesTab } from '@/components/admin/contacts/SavedSearchesTab'
```

In the `<PropertyInterestsPanel contactId={id} />` section, this panel has its own internal tabs. Instead of embedding `SavedSearchesTab` inside it, add it as a sibling card below `PropertyInterestsPanel` in the left sidebar:

After `<PropertyInterestsPanel contactId={id} />`, add:
```typescript
<Card>
  <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-4">Saved Searches</p>
  <SavedSearchesTab contactId={id} />
</Card>
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/admin/contacts/SavedSearchesTab.tsx "app/admin/contacts/[id]/page.tsx"
git commit -m "feat: add SavedSearchesTab to contact profile"
```

---

## Final Verification

- [ ] **Confirm TypeScript passes clean**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **End-to-end smoke test**

With `npm run dev` running:

1. `POST /api/reso/sync` — confirm listings sync from mock
2. Visit `/listings` — listings appear, filters work
3. Click a listing — detail page shows RESO fields, gate activates after N views
4. Complete email gate verification — `re_verified` cookie set
5. Return to `/listings` — "Save this search" button appears
6. Save a search — verify in admin contact profile under Saved Searches
7. Visit `/admin/settings` — RESO sync widget shows last sync from `ResoSyncLog`
8. Click "Sync Now" — triggers `/api/reso/sync`

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: complete RESO IDX integration with mock API, PropertyService, and saved searches"
```
