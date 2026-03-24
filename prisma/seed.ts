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
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
