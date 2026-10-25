'use client'

import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Laptop, Smartphone } from 'lucide-react'
import { AccountT as T } from '@/components/common/AccountT'
import { FormError } from '@/components/common/FormStatus'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { allAccountMessages } from '@/hooks/useAccountT'
import { formatDate } from '@/lib/format'
import { logoutAll } from '@/services/auth.service'
import { endSession, listSessions } from '@/services/member.service'
import { Section } from './Section'

const BROWSERS = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/SamsungBrowser/, 'Samsung Internet'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]
const SYSTEMS = [
  [/Android/, 'Android'],
  [/iPhone|iPad/, 'iOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
]

/** "Chrome on Android" from a user agent; null when it is not a known browser. */
function describe(userAgent = '') {
  const browser = BROWSERS.find(([re]) => re.test(userAgent))?.[1]
  const system = SYSTEMS.find(([re]) => re.test(userAgent))?.[1]
  if (!browser && !system) return null
  return [browser, system].filter(Boolean).join(' on ')
}

export function SessionList() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const sessions = useQuery({ queryKey: ['account', 'sessions'], queryFn: listSessions })
  const end = useMutation({
    mutationFn: endSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', 'sessions'] }),
  })
  const everywhere = useMutation({
    mutationFn: logoutAll,
    onSuccess: () => router.replace('/login'),
  })

  return (
    <Section titleKey="account.sessions.title">
      <p className="text-text-muted">
        <T k="account.sessions.intro" />
      </p>
      <FormError
        error={end.error ?? everywhere.error ?? sessions.error}
        messages={allAccountMessages}
      />
      {sessions.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.data?.map((s) => {
            const mobile = /Mobile|Android|iPhone/.test(s.userAgent ?? '')
            const Icon = mobile ? Smartphone : Laptop
            const name = describe(s.userAgent ?? '')
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-box border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <Icon aria-hidden="true" className="size-5 text-text-muted" />
                  <div className="flex flex-col">
                    <span className="font-semibold">
                      {name ?? <T k="account.sessions.unknown" />}
                    </span>
                    <span className="text-sm text-text-muted">
                      <T k="account.sessions.since" /> {formatDate(s.createdAt)}
                      {s.ip && ` · ${s.ip}`}
                    </span>
                  </div>
                </div>
                {s.current ? (
                  <Badge tone="success">
                    <T k="account.sessions.current" />
                  </Badge>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => end.mutate(s.id)}
                    loading={end.isPending && end.variables === s.id}
                  >
                    <T k="account.sessions.signOut" />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <Button
        variant="secondary"
        onClick={() => everywhere.mutate()}
        loading={everywhere.isPending}
        className="self-start"
      >
        <T k="account.sessions.signOutAll" />
      </Button>
    </Section>
  )
}
