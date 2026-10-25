import { create } from 'zustand'

/**
 * Auth state only (server data lives in TanStack Query). The access token itself is kept in
 * services/api.js, in memory, never in this store or in storage.
 * status: 'idle' (not checked yet) | 'loading' | 'authenticated' | 'anonymous'
 */
export const useAuthStore = create((set) => ({
  user: null,
  status: 'idle',
  setUser: (user) => set({ user, status: 'authenticated' }),
  setLoading: () => set({ status: 'loading' }),
  clear: () => set({ user: null, status: 'anonymous' }),
}))
