'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button, Modal, useToast } from '@/components/ui'

interface Props {
  contactId:   string
  contactName: string
}

export function DeleteContactButton({ contactId, contactName }: Props) {
  const router     = useRouter()
  const { toast }  = useToast()
  const [open, setOpen]         = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/contacts/${contactId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast('success', 'Contact deleted')
      router.push('/admin/contacts')
    } catch {
      toast('error', 'Failed to delete contact', 'Please try again.')
      setDeleting(false)
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
        <Trash2 size={15} />
        Delete
      </Button>

      <Modal open={open} onClose={() => !deleting && setOpen(false)} title="Delete Contact" size="sm">
        <p className="text-sm text-charcoal-600 mb-6">
          Are you sure you want to permanently delete <strong>{contactName}</strong>?
          All communications, notes, tasks, and campaign enrollments will be removed.
          This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            Delete Contact
          </Button>
        </div>
      </Modal>
    </>
  )
}
