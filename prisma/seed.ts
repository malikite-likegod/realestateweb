import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEAL_STAGES = [
  { name: 'New Lead',       order: 1, color: '#6366f1' },
  { name: 'Contacted',      order: 2, color: '#8b5cf6' },
  { name: 'Showing',        order: 3, color: '#f59e0b' },
  { name: 'Offer Made',     order: 4, color: '#ef4444' },
  { name: 'Under Contract', order: 5, color: '#10b981' },
  { name: 'Closed',         order: 6, color: '#059669' },
]

const BUDGET_GROUPS: { name: string; order: number; categories: { name: string; color: string; order: number }[] }[] = [
  {
    name: 'Professional Fees', order: 0,
    categories: [
      { name: 'MLS / Board Dues',     color: '#6366f1', order: 0 },
      { name: 'E&O Insurance',        color: '#8b5cf6', order: 1 },
      { name: 'Business Insurance',   color: '#a78bfa', order: 2 },
      { name: 'Legal & Accounting',   color: '#7c3aed', order: 3 },
      { name: 'Brokerage Fees',       color: '#4f46e5', order: 4 },
    ],
  },
  {
    name: 'Marketing', order: 1,
    categories: [
      { name: 'Online Advertising',       color: '#f59e0b', order: 0 },
      { name: 'Photography / Video',      color: '#d97706', order: 1 },
      { name: 'Signs & Riders',           color: '#b45309', order: 2 },
      { name: 'Print Marketing',          color: '#fbbf24', order: 3 },
      { name: 'Website & SEO',            color: '#f97316', order: 4 },
    ],
  },
  {
    name: 'Operating Expenses', order: 2,
    categories: [
      { name: 'Office / Desk Fees',       color: '#10b981', order: 0 },
      { name: 'Phone & Internet',         color: '#059669', order: 1 },
      { name: 'Software & Subscriptions', color: '#34d399', order: 2 },
      { name: 'Office Supplies',          color: '#6ee7b7', order: 3 },
      { name: 'Printing & Postage',       color: '#047857', order: 4 },
    ],
  },
  {
    name: 'Vehicle & Travel', order: 3,
    categories: [
      { name: 'Gas & Fuel',          color: '#3b82f6', order: 0 },
      { name: 'Vehicle Maintenance', color: '#2563eb', order: 1 },
      { name: 'Parking & Tolls',     color: '#60a5fa', order: 2 },
    ],
  },
  {
    name: 'Education & Development', order: 4,
    categories: [
      { name: 'Courses & Designations', color: '#ec4899', order: 0 },
      { name: 'Books & Resources',      color: '#db2777', order: 1 },
      { name: 'Conferences & Events',   color: '#f472b6', order: 2 },
    ],
  },
  {
    name: 'Client Entertainment', order: 5,
    categories: [
      { name: 'Client Gifts',       color: '#ef4444', order: 0 },
      { name: 'Meals & Dining',     color: '#dc2626', order: 1 },
    ],
  },
]

const DEFAULT_TASK_TYPES = [
  { name: 'Call',             color: '#3b82f6', textColor: '#ffffff', isDefault: true },
  { name: 'Meeting',          color: '#8b5cf6', textColor: '#ffffff', isDefault: true },
  { name: 'Email',            color: '#10b981', textColor: '#ffffff', isDefault: true },
  { name: 'Follow-Up',        color: '#f59e0b', textColor: '#ffffff', isDefault: true },
  { name: 'Property Showing', color: '#ef4444', textColor: '#ffffff', isDefault: true },
  { name: 'Document Review',  color: '#6366f1', textColor: '#ffffff', isDefault: true },
  { name: 'Offer Prep',       color: '#ec4899', textColor: '#ffffff', isDefault: true },
  { name: 'Contract Review',  color: '#14b8a6', textColor: '#ffffff', isDefault: true },
  { name: 'To-Do',            color: '#64748b', textColor: '#ffffff', isDefault: true },
]

async function main() {
  // Create default admin if none exists
  const existing = await prisma.user.findUnique({ where: { email: 'miketaylor.realty@gmail.com' } })
  if (!existing) {
    const passwordHash = await bcrypt.hash('letmein', 12)
    await prisma.user.create({
      data: {
        name:         'Michael Taylor',
        email:        'miketaylor.realty@gmail.com',
        passwordHash,
        role:         'admin',
      },
    })
    console.log('✓ Default admin account created')
  } else {
    console.log('✓ Admin account already exists — skipping')
  }

  // Seed deal stages if not present
  const stageCount = await prisma.stage.count()
  if (stageCount === 0) {
    await prisma.stage.createMany({ data: DEAL_STAGES })
    console.log('✓ Deal stages seeded')
  }

  // Upsert default task types (safe to re-run)
  for (const tt of DEFAULT_TASK_TYPES) {
    await prisma.taskType.upsert({
      where:  { name: tt.name },
      update: { isDefault: true },
      create: tt,
    })
  }
  console.log('✓ Default task types seeded')

  // Seed default budget groups + categories if none exist
  const groupCount = await prisma.budgetGroup.count()
  if (groupCount === 0) {
    for (const g of BUDGET_GROUPS) {
      const group = await prisma.budgetGroup.create({ data: { name: g.name, order: g.order } })
      await prisma.budgetCategory.createMany({
        data: g.categories.map(c => ({ ...c, groupId: group.id })),
      })
    }
    console.log('✓ Default budget categories seeded')
  } else {
    console.log('✓ Budget categories already exist — skipping')
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
