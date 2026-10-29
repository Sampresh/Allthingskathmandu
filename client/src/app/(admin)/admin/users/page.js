'use client'

import { useState } from 'react'
import { canSee } from '@/components/admin/adminNav'
import { ConfirmButton } from '@/components/admin/ConfirmButton'
import { DataTable } from '@/components/admin/DataTable'
import { SelectField, TextField } from '@/components/admin/Fields'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { PageHeader } from '@/components/admin/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAdminList } from '@/hooks/useAdminList'
import { formatDate } from '@/lib/format'
import { users } from '@/services/admin.service'
import { useAuthStore } from '@/store/authStore'

const ROLES = ['MEMBER', 'BUSINESS_OWNER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN']
const STAFF = ['MODERATOR', 'ADMIN', 'SUPER_ADMIN']

function RoleControl({ user, onChanged }) {
  const toast = useToast()
  const [role, setRole] = useState(user.role)
  return (
    <div className="flex items-end gap-2">
      <SelectField
        label={`Role for ${user.email}`}
        value={role}
        onChange={(e) => setRole(e.target.value)}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r.replace('_', ' ').toLowerCase()}
          </option>
        ))}
      </SelectField>
      <ConfirmButton
        variant="primary"
        disabled={role === user.role}
        title="Change role"
        message={`Make ${user.email} a ${role.replace('_', ' ').toLowerCase()}? They will be signed out everywhere${STAFF.includes(role) ? ' and must set up two-step verification' : ''}.`}
        confirmLabel="Change role"
        onConfirm={async () => {
          try {
            await users.setRole(user.id, role)
            toast('Role changed')
            onChanged()
          } catch (err) {
            toast(errorMessage(err), 'error')
          }
        }}
      >
        Change
      </ConfirmButton>
    </div>
  )
}

export default function UsersPage() {
  const toast = useToast()
  const me = useAuthStore((s) => s.user)
  const isSuper = canSee(me.role, 'SUPER_ADMIN')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const { rows, query, tableProps } = useAdminList('users', users.list, { q: search, role, status })

  const setUserStatus = async (user, next) => {
    try {
      await users.setStatus(user.id, next)
      toast(
        next === 'SUSPENDED'
          ? `${user.email} suspended and signed out`
          : `${user.email} reactivated`,
      )
      query.refetch()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'User',
      render: (u) => (
        <>
          <span className="font-semibold">{u.name}</span>
          <br />
          <span className="text-text-muted">{u.email}</span>
        </>
      ),
    },
    { key: 'role', header: 'Role', render: (u) => u.role.replace('_', ' ').toLowerCase() },
    {
      key: 'status',
      header: 'Status',
      render: (u) =>
        u.status === 'ACTIVE' ? (
          <Badge tone="success">Active</Badge>
        ) : (
          <Badge tone="danger">Suspended</Badge>
        ),
    },
    {
      key: 'verified',
      header: 'Email verified',
      render: (u) => (u.emailVerifiedAt ? 'Yes' : 'No'),
    },
    { key: 'listings', header: 'Listings', render: (u) => u._count.businesses },
    {
      key: 'lastLoginAt',
      header: 'Last login',
      render: (u) => (u.lastLoginAt ? formatDate(u.lastLoginAt) : '—'),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (u) => {
        if (u.id === me.id) return <span className="text-sm text-text-muted">You</span>
        const canManage = isSuper || !STAFF.includes(u.role)
        return (
          <div className="flex flex-col gap-2">
            {canManage &&
              (u.status === 'ACTIVE' ? (
                <ConfirmButton
                  title="Suspend user"
                  message={`Suspend ${u.email}? They are signed out and cannot log in.`}
                  confirmLabel="Suspend"
                  onConfirm={() => setUserStatus(u, 'SUSPENDED')}
                >
                  Suspend
                </ConfirmButton>
              ) : (
                <Button variant="secondary" onClick={() => setUserStatus(u, 'ACTIVE')}>
                  Reactivate
                </Button>
              ))}
            {isSuper && <RoleControl user={u} onChanged={() => query.refetch()} />}
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Users" />
      <form
        role="search"
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          setSearch(q.trim())
        }}
      >
        <TextField
          label="Search name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-64"
        />
        <SelectField label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Any role</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace('_', ' ').toLowerCase()}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </SelectField>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      <DataTable
        caption="Users"
        columns={columns}
        rows={rows}
        rowLabel={(u) => u.email}
        empty="No users match."
        {...tableProps}
      />
    </div>
  )
}
