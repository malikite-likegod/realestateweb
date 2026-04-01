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
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
