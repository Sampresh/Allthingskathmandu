import { api, unwrap, unwrapWithMeta } from './api'

const toParams = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false),
  )

export const getCategoryListings = (slug, params) =>
  api.get(`/public/categories/${slug}/listings`, { params: toParams(params) }).then(unwrapWithMeta)

export const searchListings = (params) =>
  api.get('/public/search', { params: toParams(params) }).then(unwrapWithMeta)

export const suggest = (q, { signal } = {}) =>
  api.get('/public/search/suggest', { params: { q }, signal }).then(unwrap)

export const getListingReviews = (slug, cursor) =>
  api.get(`/public/listings/${slug}/reviews`, { params: toParams({ cursor }) }).then(unwrapWithMeta)

export const getHomeNear = (point) => api.get('/public/home', { params: point }).then(unwrap)

export const sendReport = (body) => api.post('/public/reports', body).then(unwrap)

export const sendContact = (body) => api.post('/public/contact', body).then(unwrap)

export const getEvents = (params) =>
  api.get('/public/events', { params: toParams(params) }).then(unwrapWithMeta)

export const getMarketItems = (params) =>
  api.get('/public/market', { params: toParams(params) }).then(unwrapWithMeta)
