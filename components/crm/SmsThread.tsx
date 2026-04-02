'use client'

/**
 * SmsThread
 *
 * Displays an SMS conversation thread per contact (similar to iMessage bubbles)
 * and provides a composer to send new messages. Polls for new inbound messages
 * every 10 seconds while the component is mounted.
 */

import { useState, useEffect, useRef } from 'react'
import { Send, MessageSquare } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Button, useToast } from '@/components/ui'

export type SmsEntry = {
  id:         string
  direction:  'inbound' | 'outbound'
  status:     string
  body:       string
  fromNumber: string | null
  toNumber:   string | null
  sentBy:     { name: string } | null
  sentAt:     Date | string
}

interface SmsThreadProps {
  initialMessages: SmsEntry[]
  contactId:       string
  contactPhone?:   string | null
  smsOptOut?:      boolean
}

export function SmsThread({ initialMessages, contactId, contactPhone, smsOptOut = false }: SmsThreadProps) {
  const [messages,  setMessages]  = useState<SmsEntry[]>(initialMessages)
  const [text, setText]           = useState('')
  const [signature, setSignature] = useState('')
  const [sending, setSending]     = useState(false)
  const bottomRef                 = useRef<HTMLDivElement>(null)
  const { toast }                 = useToast()

  // Load SMS signature on mount
  useEffect(() => {
    fetch('/api/settings/signature')
      .then(r => r.json())
      .then(json => { if (json.data?.smsSignature) setSignature(json.data.smsSignature) })
      .catch(() => {})
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Poll for new inbound messages every 10 seconds
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res  = await fetch(`/api/sms?contactId=${contactId}&pageSize=100`)
        const json = await res.json()
        if (json.data) setMessages(json.data)
      } catch { /* silent */ }
    }, 10_000)
    return () => clearInterval(id)
  }, [contactId])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !contactPhone) return
    setSending(true)
    try {
      const finalBody = signature.trim() ? `${text.trim()} ${signature.trim()}` : text.trim()
      const res = await fetch('/api/sms', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ contactId, body: finalBody, toNumber: contactPhone }),
      })
      if (!res.ok) throw new Error('Failed to send')
      const { data } = await res.json()
      setMessages(prev => [...prev, data])
      setText('')
      toast('success', 'SMS sent')
    } catch (err) {
      console.error(err)
      toast('error', 'Failed to send SMS', 'Check your Twilio configuration.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 320 }}>
      {/* Message bubbles */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 p-2 bg-charcoal-50 rounded-xl mb-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-charcoal-300 gap-2">
            <MessageSquare size={28} />
            <p className="text-sm">No messages yet. Start the conversation.</p>
          </div>
        )}
        {messages.map(msg => {
          const isOut = msg.direction === 'outbound'
          return (
            <div key={msg.id} className={`flex flex-col ${isOut ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                isOut
                  ? 'bg-charcoal-900 text-white rounded-br-sm'
                  : 'bg-white border border-charcoal-200 text-charcoal-900 rounded-bl-sm'
              }`}>
                {msg.body}
              </div>
              <span className="text-xs text-charcoal-300 mt-0.5 px-1">
                {formatDate(new Date(msg.sentAt), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                {isOut && msg.sentBy && ` · ${msg.sentBy.name}`}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      {smsOptOut ? (
        <div className="px-4 py-3 border-t border-charcoal-100 text-sm text-red-700 bg-red-50">
          This contact has opted out of SMS communications. Edit the contact to re-enable.
        </div>
      ) : contactPhone ? (
        <div className="flex flex-col gap-1.5">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={`Message ${contactPhone}…`}
              className="flex-1 rounded-xl border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
            />
            <Button type="submit" variant="primary" size="sm" loading={sending} leftIcon={<Send size={14} />}>
              Send
            </Button>
          </form>
          {signature.trim() && (
            <p className="text-xs text-charcoal-400 px-1">
              Signature will be appended: <span className="text-charcoal-500 italic">{signature.trim()}</span>
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-charcoal-400 text-center">Add a phone number to this contact to enable SMS.</p>
      )}
    </div>
  )
}
