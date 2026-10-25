'use client'

import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { hasSessionHint, refreshSession } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

function AuthBootstrap() {
  useEffect(() => {
    // Restore the session once per page load, only when the API says one may exist.
    if (useAuthStore.getState().status !== 'idle') return
    if (!hasSessionHint()) {
      useAuthStore.getState().clear()
      return
    }
    useAuthStore.getState().setLoading()
    refreshSession().catch(() => {})
  }, [])
  return null
}

export function Providers({ children }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap />
      {children}
    </QueryClientProvider>
  )
}
