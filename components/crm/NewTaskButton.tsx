'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'
import { TaskModal } from '@/components/calendar'
import { Plus } from 'lucide-react'

export function NewTaskButton() {
  const [modalOpen, setModalOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <Button
        variant="primary"
        leftIcon={<Plus size={16} />}
        onClick={() => setModalOpen(true)}
      >
        New Task
      </Button>

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => router.refresh()}
      />
    </>
  )
}
