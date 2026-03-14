import { prisma } from '@/lib/prisma'
import { callAI } from './client'
import type { AiJobType } from '@/types'

export async function enqueueJob(type: AiJobType, input: Record<string, unknown>, userId?: string): Promise<string> {
  const job = await prisma.aiJob.create({
    data: { type, input: JSON.stringify(input), userId: userId ?? null },
  })
  return job.id
}

export async function processJob(jobId: string): Promise<void> {
  const job = await prisma.aiJob.findUnique({ where: { id: jobId } })
  if (!job || job.status !== 'pending') return

  await prisma.aiJob.update({ where: { id: jobId }, data: { status: 'running', startedAt: new Date() } })

  let output = ''
  let tokensUsed = 0
  let model = ''

  try {
    const input = JSON.parse(job.input) as Record<string, unknown>

    switch (job.type as AiJobType) {
      case 'blog_generation': {
        const res = await callAI(
          `Write a professional real estate blog post about: ${input.topic}. Include H2 headings, practical tips, and a call to action. Approximately 600-800 words.`,
          { systemPrompt: 'You are a professional real estate content writer.' }
        )
        output = res.content; tokensUsed = res.tokensUsed; model = res.model
        break
      }

      case 'listing_description': {
        const res = await callAI(
          `Write a luxury listing description for: ${JSON.stringify(input)}. Under 200 words, lifestyle-focused.`,
          { systemPrompt: 'You are a luxury real estate copywriter.' }
        )
        output = res.content; tokensUsed = res.tokensUsed; model = res.model
        break
      }

      case 'lead_scoring': {
        const res = await callAI(
          `Analyze this lead data and provide a score from 0-100 and a brief reason: ${JSON.stringify(input)}. Respond as JSON: {"score": number, "reason": string}`,
          { systemPrompt: 'You are a real estate lead scoring AI.' }
        )
        output = res.content; tokensUsed = res.tokensUsed; model = res.model
        break
      }

      case 'market_analysis': {
        const res = await callAI(
          `Analyze this real estate market data and provide insights: ${JSON.stringify(input)}`,
          { systemPrompt: 'You are a real estate market analyst.', maxTokens: 2048 }
        )
        output = res.content; tokensUsed = res.tokensUsed; model = res.model
        break
      }

      case 'buyer_intent': {
        const res = await callAI(
          `Based on this buyer behavior data, assess purchase intent and timeframe: ${JSON.stringify(input)}. Respond as JSON: {"intent": "low|medium|high", "timeframe": "string", "reason": "string"}`,
          { systemPrompt: 'You are a real estate buyer intent analyzer.' }
        )
        output = res.content; tokensUsed = res.tokensUsed; model = res.model
        break
      }
    }

    await prisma.aiResult.create({
      data: { jobId, output, tokensUsed, model },
    })
    await prisma.aiJob.update({
      where: { id: jobId },
      data: { status: 'completed', completedAt: new Date() },
    })
  } catch (e) {
    await prisma.aiJob.update({
      where: { id: jobId },
      data: { status: 'failed', completedAt: new Date() },
    })
    throw e
  }
}
