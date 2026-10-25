import { api, unwrap } from './api'

const base = (id) => `/business/listings/${id}`

/** Business portal API (Part 6 §5). */
export const myListings = () => api.get('/business/listings').then(unwrap)
export const getListing = (id) => api.get(base(id)).then(unwrap)
export const updateListing = (id, body) => api.patch(base(id), body).then(unwrap)
export const putHours = (id, hours) => api.put(`${base(id)}/hours`, { hours }).then(unwrap)
export const putLocation = (id, body) => api.put(`${base(id)}/location`, body).then(unwrap)
export const signLogo = (id) => api.post(`${base(id)}/logo/sign`).then(unwrap)
export const signMedia = (id) => api.post(`${base(id)}/media/sign`).then(unwrap)
export const addMedia = (id, body) => api.post(`${base(id)}/media`, body).then(unwrap)
export const reorderMedia = (id, ids) => api.patch(`${base(id)}/media/order`, { ids }).then(unwrap)
export const deleteMedia = (id, mediaId) => api.delete(`${base(id)}/media/${mediaId}`).then(unwrap)
export const listOffers = (id) => api.get(`${base(id)}/offers`).then(unwrap)
export const createOffer = (id, body) => api.post(`${base(id)}/offers`, body).then(unwrap)
export const updateOffer = (id, offerId, body) =>
  api.patch(`${base(id)}/offers/${offerId}`, body).then(unwrap)
export const deleteOffer = (id, offerId) => api.delete(`${base(id)}/offers/${offerId}`).then(unwrap)
export const getStats = (id, params) => api.get(`${base(id)}/stats`, { params }).then(unwrap)
export const getSubscription = (id) => api.get(`${base(id)}/subscription`).then(unwrap)
export const getInvoices = (id) => api.get(`${base(id)}/invoices`).then(unwrap)

// Member side: claims and "List your business".
export const myClaims = () => api.get('/me/claims').then(unwrap)
export const signClaimProof = () => api.post('/me/claims/proof/sign').then(unwrap)
export const createClaim = (body) => api.post('/me/claims', body).then(unwrap)
export const submitListing = (body) => api.post('/me/listings', body).then(unwrap)

// Public data the portal needs (categories, areas, plans).
export const publicGroups = () => api.get('/public/groups').then(unwrap)
export const publicAreas = () => api.get('/public/areas').then(unwrap)
export const publicPlans = () => api.get('/public/plans').then(unwrap)
export const findListings = (q) =>
  api.get('/public/search', { params: { q, limit: 10 } }).then(unwrap)
