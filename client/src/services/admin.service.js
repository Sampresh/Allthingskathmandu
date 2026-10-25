import { api, unwrap, unwrapWithMeta } from './api'

const clean = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  )

const get = (path, params) => api.get(`/admin${path}`, { params: clean(params) })

/** Admin API (Part 6 §7). Lists resolve to { data, meta: { nextCursor } }. */
const crud = (path) => ({
  list: (params) => get(path, params).then(unwrap),
  create: (body) => api.post(`/admin${path}`, body).then(unwrap),
  update: (id, body) => api.patch(`/admin${path}/${id}`, body).then(unwrap),
  remove: (id) => api.delete(`/admin${path}/${id}`).then(unwrap),
})

export const overview = () => get('/overview').then(unwrap)

export const listings = {
  list: (params) => get('/listings', params).then(unwrapWithMeta),
  get: (id) => get(`/listings/${id}`).then(unwrap),
  create: (body) => api.post('/admin/listings', body).then(unwrap),
  update: (id, body) => api.patch(`/admin/listings/${id}`, body).then(unwrap),
  remove: (id) => api.delete(`/admin/listings/${id}`).then(unwrap),
  setStatus: (id, status) => api.post(`/admin/listings/${id}/status`, { status }).then(unwrap),
  assignOwner: (id, email) =>
    api.post(`/admin/listings/${id}/assign-owner`, { email }).then(unwrap),
  importCsv: (csv) => api.post('/admin/listings/import', { csv }).then(unwrap),
  importStatus: (jobId) => get(`/listings/import/${jobId}`).then(unwrap),
}

export const claims = {
  list: (params) => get('/claims', params).then(unwrapWithMeta),
  approve: (id) => api.post(`/admin/claims/${id}/approve`).then(unwrap),
  reject: (id, reason) => api.post(`/admin/claims/${id}/reject`, { reason }).then(unwrap),
}

export const reviews = {
  list: (params) => get('/reviews', params).then(unwrapWithMeta),
  approve: (id) => api.post(`/admin/reviews/${id}/approve`).then(unwrap),
  reject: (id) => api.post(`/admin/reviews/${id}/reject`).then(unwrap),
}

export const events = {
  list: (params) => get('/events', params).then(unwrapWithMeta),
  approve: (id) => api.post(`/admin/events/${id}/approve`).then(unwrap),
  reject: (id, reason) => api.post(`/admin/events/${id}/reject`, { reason }).then(unwrap),
  update: (id, body) => api.patch(`/admin/events/${id}`, body).then(unwrap),
  remove: (id) => api.delete(`/admin/events/${id}`),
}

export const market = {
  list: (params) => get('/market', params).then(unwrapWithMeta),
  approve: (id) => api.post(`/admin/market/${id}/approve`).then(unwrap),
  reject: (id, reason) => api.post(`/admin/market/${id}/reject`, { reason }).then(unwrap),
  remove: (id) => api.delete(`/admin/market/${id}`),
}

export const reports = {
  list: (params) => get('/reports', params).then(unwrapWithMeta),
  update: (id, status) => api.patch(`/admin/reports/${id}`, { status }).then(unwrap),
}

export const categories = {
  ...crud('/categories'),
  reorder: (items) => api.patch('/admin/categories/reorder', { items }).then(unwrap),
}
export const tags = crud('/tags')
export const areas = crud('/areas')
export const synonyms = crud('/synonyms')

export const sections = {
  ...crud('/home-sections'),
  reorder: (ids) => api.patch('/admin/home-sections/reorder', { ids }).then(unwrap),
}

export const pages = {
  ...crud('/pages'),
  get: (id) => get(`/pages/${id}`).then(unwrap),
}

export const settings = {
  list: () => get('/settings').then(unwrap),
  put: (key, value) => api.put(`/admin/settings/${key}`, { value }).then(unwrap),
}

export const plans = crud('/plans')

export const media = {
  list: (params) => get('/media', params).then(unwrapWithMeta),
  remove: (id) => api.delete(`/admin/media/${id}`).then(unwrap),
}

export const payments = {
  list: (params) => get('/payments', params).then(unwrapWithMeta),
  get: (id) => get(`/payments/${id}`).then(unwrap),
}

export const users = {
  list: (params) => get('/users', params).then(unwrapWithMeta),
  setStatus: (id, status) => api.patch(`/admin/users/${id}/status`, { status }).then(unwrap),
  setRole: (id, role) => api.patch(`/admin/users/${id}/role`, { role }).then(unwrap),
}

export const audit = { list: (params) => get('/audit', params).then(unwrapWithMeta) }

export const purgeCache = (body) => api.post('/admin/cache/purge', body).then(unwrap)
