import { api, setAccessToken, unwrap, unwrapWithMeta } from './api'
import { useAuthStore } from '@/store/authStore'

/** Member area API (Part 6 §4). */
export const getProfile = () => api.get('/me').then(unwrap)
export const updateProfile = (body) => api.patch('/me', body).then(unwrap)
export const changePassword = (body) => api.patch('/me/password', body).then(unwrap)

export async function deleteAccount(body) {
  await api.delete('/me', { data: body })
  setAccessToken(null)
  useAuthStore.getState().clear()
}

export const listSessions = () => api.get('/me/sessions').then(unwrap)
export const endSession = (id) => api.delete(`/me/sessions/${id}`)

/** Saved listings page: { data, meta: { nextCursor } }. */
export const listSaved = (cursor) =>
  api.get('/me/saved', { params: { cursor } }).then(unwrapWithMeta)
export const isSaved = (businessId) =>
  api.get('/me/saved', { params: { businessId, limit: 1 } }).then((res) => unwrap(res).length > 0)
export const saveListing = (businessId) => api.put(`/me/saved/${businessId}`).then(unwrap)
export const unsaveListing = (businessId) => api.delete(`/me/saved/${businessId}`).then(unwrap)

/** My reviews page: { data, meta: { nextCursor } }. */
export const myReviews = (cursor) =>
  api.get('/me/reviews', { params: { cursor } }).then(unwrapWithMeta)
export const createReview = (body) => api.post('/me/reviews', body).then(unwrap)
export const updateReview = (id, body) => api.patch(`/me/reviews/${id}`, body).then(unwrap)
export const deleteReview = (id) => api.delete(`/me/reviews/${id}`)

// Market items (Part 6 §4).
export const myMarketItems = (cursor) =>
  api.get('/me/market', { params: { cursor } }).then(unwrapWithMeta)
export const createMarketItem = (body) => api.post('/me/market', body).then(unwrap)
export const updateMarketItem = (id, body) => api.patch(`/me/market/${id}`, body).then(unwrap)
export const deleteMarketItem = (id) => api.delete(`/me/market/${id}`)
export const markItemSold = (id) => api.post(`/me/market/${id}/sold`).then(unwrap)
export const signMarketPhoto = () => api.post('/me/market/media/sign').then(unwrap)
export const marketCategories = () => api.get('/public/market/categories').then(unwrap)
export const areas = () => api.get('/public/areas').then(unwrap)

// Events (members' submissions).
export const myEvents = (cursor) =>
  api.get('/me/events', { params: { cursor } }).then(unwrapWithMeta)
export const submitEvent = (body) => api.post('/me/events', body).then(unwrap)
export const signEventCover = () => api.post('/me/events/cover/sign').then(unwrap)
