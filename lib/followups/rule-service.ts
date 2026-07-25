/**
 * FollowUpRule CRUD — thin wrapper used by the admin cadence editor
 * (app/admin/followups). Rows are seeded via prisma/migrations/add_followup_rules.sql;
 * this service only supports editing the 5 fixed segments, not creating new ones.
 */

import { prisma } from '@/lib/prisma'

export async function getFollowUpRules() {
  return prisma.followUpRule.findMany({ orderBy: { segment: 'asc' } })
}

export async function updateFollowUpRule(
  id: string,
  data: Partial<{
    intervalDays:      number
    preferredChannel:  string
    taskTitleTemplate: string
    priority:          string
    isActive:          boolean
  }>,
) {
  return prisma.followUpRule.update({ where: { id }, data })
}
