'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '../Fields'

/** Move to Trash: the listing leaves the public site and can be restored. */
export function DeleteDialog({ listing, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false)
  return (
    <Dialog
      open={Boolean(listing)}
      onClose={onClose}
      title={`Move ${listing?.name ?? 'listing'} to Trash?`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true)
              await onConfirm(listing)
              setBusy(false)
              onClose()
            }}
          >
            Move to Trash
          </Button>
        </div>
      }
    >
      <p>It leaves the public site within seconds. You can restore it from the Trash tab.</p>
    </Dialog>
  )
}

/** Delete for good (super admin): the name must be typed exactly. */
export function PermanentDeleteDialog({ listing, onClose, onConfirm }) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const matches = listing && typed.trim().toLowerCase() === listing.name.trim().toLowerCase()
  const close = () => {
    setTyped('')
    onClose()
  }
  return (
    <Dialog
      open={Boolean(listing)}
      onClose={close}
      title="Delete for good?"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!matches}
            loading={busy}
            onClick={async () => {
              setBusy(true)
              await onConfirm(listing, typed)
              setBusy(false)
              close()
            }}
          >
            Delete for good
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p>
          This removes <strong>{listing?.name}</strong>, its photos, reviews and history links. It
          cannot be undone.
        </p>
        <TextField
          label="Type the listing name to confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
      </div>
    </Dialog>
  )
}
