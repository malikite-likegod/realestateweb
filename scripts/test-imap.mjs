/**
 * Run inside the Docker container to test ImapFlow directly:
 *   docker compose exec app node scripts/test-imap.mjs
 */
import { ImapFlow } from 'imapflow'

const client = new ImapFlow({
  host:    process.env.IMAP_HOST,
  port:    Number(process.env.IMAP_PORT ?? 993),
  secure:  true,
  auth:    { user: process.env.IMAP_USER, pass: process.env.IMAP_PASS },
  logger:  {
    debug: (o) => console.log('[D]', JSON.stringify(o)),
    info:  (o) => console.log('[I]', JSON.stringify(o)),
    warn:  (o) => console.warn('[W]', JSON.stringify(o)),
    error: (o) => console.error('[E]', JSON.stringify(o)),
  },
  connectionTimeout: 15_000,
})

client.on('error', e => console.error('[socket-error]', e.message, e.code))

try {
  console.log('→ connect()')
  await client.connect()
  console.log('✓ connected')

  console.log('→ getMailboxLock(INBOX)')
  const lock = await client.getMailboxLock(process.env.IMAP_MAILBOX ?? 'INBOX')
  console.log('✓ mailbox locked')

  const uids = await client.search({ seen: false }, { uid: true })
  console.log(`✓ search done — ${uids?.length ?? 0} unseen message(s)`)

  lock.release()
} catch (err) {
  console.error('FAILED:', err.message, err.code)
} finally {
  try { await client.logout() } catch {}
  console.log('done')
}
