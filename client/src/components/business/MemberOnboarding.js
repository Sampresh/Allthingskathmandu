'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TextArea, TextField, SelectField } from '@/components/admin/Fields'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Uploader } from '@/components/ui/Uploader'
import { formatDate } from '@/lib/format'
import {
  createClaim,
  findListings,
  myClaims,
  publicAreas,
  publicGroups,
  signClaimProof,
  submitListing,
} from '@/services/business.service'

function ClaimListing({ onDone }) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [chosen, setChosen] = useState(null)
  const [note, setNote] = useState('')
  const [proof, setProof] = useState(null)

  const search = async (e) => {
    e.preventDefault()
    if (!q.trim()) return
    setResults((await findListings(q.trim())).results)
  }

  const send = async () => {
    try {
      await createClaim({
        businessId: chosen.id,
        note: note.trim() || null,
        ...(proof && { proofPublicId: proof }),
      })
      toast('Claim sent. We will email you when it is reviewed.')
      setChosen(null)
      setNote('')
      setProof(null)
      onDone()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-box border border-border p-4">
      <h2 className="text-lg font-semibold">Claim your listing</h2>
      <p className="text-sm text-text-muted">
        Already on All Things Kathmandu? Find it and tell us how we can confirm it is yours.
      </p>
      {!chosen ? (
        <>
          <form onSubmit={search} className="flex items-end gap-2">
            <TextField
              label="Business name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" variant="secondary">
              Find
            </Button>
          </form>
          {results && (
            <ul className="flex flex-col gap-2">
              {results.length === 0 && (
                <li className="text-sm text-text-muted">Not found. Add it below instead.</li>
              )}
              {results.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-box border border-border p-3"
                >
                  <span>
                    <strong>{r.name}</strong>{' '}
                    <span className="text-sm text-text-muted">{r.area?.nameEn}</span>
                  </span>
                  <Button variant="secondary" onClick={() => setChosen(r)}>
                    This is mine
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <p>
            Claiming <strong>{chosen.name}</strong>{' '}
            <button
              type="button"
              className="text-sm text-brand underline"
              onClick={() => setChosen(null)}
            >
              Change
            </button>
          </p>
          <TextArea
            label="How can we confirm it is yours?"
            hint="For example, the business phone number we can call, or your role there"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {proof ? (
            <p className="text-sm text-success">Document added.</p>
          ) : (
            <Uploader
              label="Proof document, optional (photo of a registration certificate or bill)"
              sign={signClaimProof}
              onUploaded={({ publicId }) => setProof(publicId)}
            />
          )}
          <div>
            <Button onClick={send} disabled={!note.trim() && !proof}>
              Send claim
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function AddBusiness() {
  const toast = useToast()
  const { data: groups } = useQuery({ queryKey: ['public', 'groups'], queryFn: publicGroups })
  const { data: areas } = useQuery({ queryKey: ['public', 'areas'], queryFn: publicAreas })
  const [form, setForm] = useState({
    name: '',
    shortDesc: '',
    categoryId: '',
    phone: '',
    areaId: '',
    address: '',
  })
  const [done, setDone] = useState(false)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const send = async () => {
    try {
      await submitListing({
        name: form.name.trim(),
        shortDesc: form.shortDesc.trim(),
        categoryIds: form.categoryId ? [form.categoryId] : [],
        phone: form.phone.trim() || null,
        areaId: form.areaId || null,
        address: form.address.trim() || null,
      })
      setDone(true)
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-box border border-border p-4">
      <h2 className="text-lg font-semibold">Add a new business</h2>
      {done ? (
        <p className="text-success">
          Thanks. We will check your business and email you when it is live.
        </p>
      ) : (
        <>
          <TextField label="Business name" value={form.name} onChange={set('name')} />
          <TextArea
            label={`One-line description (${form.shortDesc.length}/120)`}
            maxLength={120}
            rows={2}
            value={form.shortDesc}
            onChange={set('shortDesc')}
          />
          <SelectField label="Category" value={form.categoryId} onChange={set('categoryId')}>
            <option value="">Choose…</option>
            {groups?.map((g) => (
              <optgroup key={g.id} label={g.nameEn}>
                {g.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameEn}
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectField>
          <p className="-mt-2 text-xs text-text-muted">
            Only categories with listings show here; tell us in the description if yours is missing.
          </p>
          <TextField label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
          <SelectField label="Area" value={form.areaId} onChange={set('areaId')}>
            <option value="">Choose…</option>
            {areas?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nameEn}
              </option>
            ))}
          </SelectField>
          <TextField label="Address" value={form.address} onChange={set('address')} />
          <div>
            <Button onClick={send}>Submit for review</Button>
          </div>
        </>
      )}
    </section>
  )
}

/** For members without a listing yet: claim an existing one or add a new one. */
export function MemberOnboarding() {
  const queryClient = useQueryClient()
  const { data: claims } = useQuery({ queryKey: ['me', 'claims'], queryFn: myClaims })
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">List your business</h1>
      {claims?.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Your claims</h2>
          <ul className="flex flex-col gap-2">
            {claims.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-box border border-border p-3"
              >
                <span>
                  {c.business.name}{' '}
                  <span className="text-sm text-text-muted">sent {formatDate(c.createdAt)}</span>
                </span>
                <Badge
                  tone={
                    c.status === 'APPROVED'
                      ? 'success'
                      : c.status === 'REJECTED'
                        ? 'danger'
                        : 'neutral'
                  }
                >
                  {c.status.toLowerCase()}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ClaimListing onDone={() => queryClient.invalidateQueries({ queryKey: ['me', 'claims'] })} />
      <AddBusiness />
    </div>
  )
}
