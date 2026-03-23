import { prisma } from '@/lib/prisma'
import type { AiCommand, AiCommandPayload } from '@/types'
import type { CommandResult } from './types'

export async function dispatchCommand(payload: AiCommandPayload, apiKeyId?: string, ipAddress?: string): Promise<CommandResult> {
  const startTime = Date.now()
  let result: CommandResult = { success: false }

  try {
    result = await executeCommand(payload.command, payload.data)
  } catch (e) {
    result = { success: false, error: e instanceof Error ? e.message : String(e) }
  }

  // Log the command
  await prisma.aiCommandLog.create({
    data: {
      command: payload.command,
      payload: JSON.stringify(payload.data),
      response: JSON.stringify(result),
      status: result.success ? 'success' : 'error',
      apiKeyId: apiKeyId ?? null,
      ipAddress: ipAddress ?? null,
      durationMs: Date.now() - startTime,
    },
  })

  return result
}

async function executeCommand(command: AiCommand, data: Record<string, unknown>): Promise<CommandResult> {
  switch (command) {
    case 'create_task': {
      const task = await prisma.task.create({
        data: {
          title: String(data.title ?? 'AI Generated Task'),
          description: data.description ? String(data.description) : null,
          priority: String(data.priority ?? 'normal'),
          status: 'todo',
          dueAt: data.dueAt ? new Date(String(data.dueAt)) : null,
          contactId: data.contactId ? String(data.contactId) : null,
          dealId: data.dealId ? String(data.dealId) : null,
        },
      })
      return { success: true, data: task }
    }

    case 'log_activity': {
      const activity = await prisma.activity.create({
        data: {
          type: String(data.type ?? 'note'),
          subject: data.subject ? String(data.subject) : null,
          body: data.body ? String(data.body) : null,
          contactId: data.contactId ? String(data.contactId) : null,
          dealId: data.dealId ? String(data.dealId) : null,
        },
      })
      return { success: true, data: activity }
    }

    case 'update_lead_score': {
      const contactId = String(data.contactId ?? '')
      const delta = Number(data.delta ?? 0)
      const contact = await prisma.contact.findUnique({ where: { id: contactId } })
      if (!contact) return { success: false, error: 'Contact not found' }

      const newScore = Math.max(0, Math.min(100, contact.leadScore + delta))
      await Promise.all([
        prisma.contact.update({ where: { id: contactId }, data: { leadScore: newScore } }),
        prisma.leadScore.create({ data: { contactId, score: newScore, delta, reason: data.reason ? String(data.reason) : null } }),
      ])
      return { success: true, data: { contactId, newScore, delta } }
    }

    case 'create_contact': {
      const contact = await prisma.contact.create({
        data: {
          firstName: String(data.firstName ?? ''),
          lastName: String(data.lastName ?? ''),
          email: data.email ? String(data.email) : null,
          phone: data.phone ? String(data.phone) : null,
          source: 'ai',
        },
      })
      return { success: true, data: contact }
    }

    case 'create_note': {
      const note = await prisma.note.create({
        data: {
          body: String(data.body ?? ''),
          contactId: data.contactId ? String(data.contactId) : null,
        },
      })
      return { success: true, data: note }
    }

    case 'generate_listing_description': {
      const propertyDetails = data.propertyDetails ? String(data.propertyDetails) : 'a luxury property'
      const listingId       = data.listingId ? String(data.listingId) : null
      const prompt = `Write a compelling luxury real estate listing description for: ${propertyDetails}. Keep it under 200 words. Focus on lifestyle and premium features.`
      const systemPrompt = 'You are an expert luxury real estate copywriter.'

      // If a listingId is provided and it maps to a RESO/MLS property, use local AI only
      if (listingId) {
        const { isMlsListing } = await import('@/lib/mls-guard')
        const isMls = await isMlsListing(listingId)
        if (isMls) {
          try {
            const { localComplete } = await import('./local-client')
            const description = await localComplete(prompt)
            return { success: true, data: { description, tokensUsed: 0 } }
          } catch (err) {
            const { OllamaUnavailableError } = await import('./local-client')
            if (err instanceof OllamaUnavailableError) {
              return { success: false, error: 'MLS listing descriptions require a locally-running AI model. See OLLAMA_BASE_URL in .env.' }
            }
            throw err
          }
        }
      }

      // Non-MLS or no listingId — external AI permitted
      const { callAI } = await import('./client')
      const response = await callAI(prompt, { systemPrompt })
      return { success: true, data: { description: response.content, tokensUsed: response.tokensUsed } }
    }

    default:
      return { success: false, error: `Unknown command: ${command}` }
  }
}
