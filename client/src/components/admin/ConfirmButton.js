'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'

/** A button that asks before running `onConfirm` (no blocking browser dialogs). */
export function ConfirmButton({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  children,
  ...props
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} {...props}>
        {children}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {cancelLabel}
            </Button>
            <Button variant={variant} onClick={confirm} loading={busy}>
              {confirmLabel}
            </Button>
          </div>
        }
      >
        <p>{message}</p>
      </Dialog>
    </>
  )
}
