import { Router } from 'express'
import * as billing from '../controllers/admin/billing.controller.js'
import * as content from '../controllers/admin/content.controller.js'
import * as listings from '../controllers/admin/listings.controller.js'
import * as moderation from '../controllers/admin/moderation.controller.js'
import * as taxonomy from '../controllers/admin/taxonomy.controller.js'
import * as users from '../controllers/admin/users.controller.js'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validate } from '../middleware/validate.js'
import * as v from '../validators/admin.validators.js'

export const adminRouter = Router()

// Staff only, with 2FA (requireRole). Areas marked below narrow it further (Part 6 §7).
adminRouter.use(verifyToken, requireRole('ADMIN', 'MODERATOR'))
adminRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

const admin = requireRole('ADMIN')
const superAdmin = requireRole('SUPER_ADMIN')
const id = validate({ params: v.idParams })

adminRouter.get('/overview', admin, users.overview)

// Listings (ADMIN)
adminRouter.get('/listings', admin, validate({ query: v.listingListQuery }), listings.list)
adminRouter.post('/listings', admin, validate({ body: v.listingCreate }), listings.create)
adminRouter.post('/listings/import', admin, validate({ body: v.importBody }), listings.importCsv)
adminRouter.get(
  '/listings/import/:jobId',
  admin,
  validate({ params: v.jobParams }),
  listings.importStatus,
)
adminRouter.get('/listings/:id', admin, id, listings.detail)
adminRouter.patch(
  '/listings/:id',
  admin,
  validate({ params: v.idParams, body: v.listingUpdate }),
  listings.update,
)
adminRouter.delete('/listings/:id', admin, id, listings.remove)
adminRouter.post(
  '/listings/:id/status',
  admin,
  validate({ params: v.idParams, body: v.listingStatusBody }),
  listings.setStatus,
)
adminRouter.post(
  '/listings/:id/assign-owner',
  admin,
  validate({ params: v.idParams, body: v.assignOwnerBody }),
  listings.assignOwner,
)

// Moderation queues (MODERATOR and up)
adminRouter.get('/claims', validate({ query: v.moderationQuery }), moderation.listClaims)
adminRouter.post('/claims/:id/approve', id, moderation.approveClaim)
adminRouter.post(
  '/claims/:id/reject',
  validate({ params: v.idParams, body: v.rejectBody }),
  moderation.rejectClaim,
)
adminRouter.get('/reviews', validate({ query: v.moderationQuery }), moderation.listReviews)
adminRouter.post('/reviews/:id/approve', id, moderation.approveReview)
adminRouter.post('/reviews/:id/reject', id, moderation.rejectReview)
adminRouter.get('/reports', validate({ query: v.reportQuery }), moderation.listReports)
adminRouter.patch(
  '/reports/:id',
  validate({ params: v.idParams, body: v.reportUpdate }),
  moderation.updateReport,
)

// Taxonomy (ADMIN)
adminRouter.get('/categories', admin, taxonomy.listCategories)
adminRouter.post(
  '/categories',
  admin,
  validate({ body: v.categoryCreate }),
  taxonomy.createCategory,
)
adminRouter.patch(
  '/categories/reorder',
  admin,
  validate({ body: v.reorderBody }),
  taxonomy.reorderCategories,
)
adminRouter.patch(
  '/categories/:id',
  admin,
  validate({ params: v.idParams, body: v.categoryUpdate }),
  taxonomy.updateCategory,
)
adminRouter.delete('/categories/:id', admin, id, taxonomy.deleteCategory)
adminRouter.get('/tags', admin, taxonomy.listTags)
adminRouter.post('/tags', admin, validate({ body: v.tagCreate }), taxonomy.createTag)
adminRouter.patch(
  '/tags/:id',
  admin,
  validate({ params: v.idParams, body: v.tagUpdate }),
  taxonomy.updateTag,
)
adminRouter.delete('/tags/:id', admin, id, taxonomy.deleteTag)
adminRouter.get('/areas', admin, taxonomy.listAreas)
adminRouter.post('/areas', admin, validate({ body: v.areaCreate }), taxonomy.createArea)
adminRouter.patch(
  '/areas/:id',
  admin,
  validate({ params: v.idParams, body: v.areaUpdate }),
  taxonomy.updateArea,
)
adminRouter.delete('/areas/:id', admin, id, taxonomy.deleteArea)
adminRouter.get('/synonyms', admin, taxonomy.listSynonyms)
adminRouter.post('/synonyms', admin, validate({ body: v.synonymCreate }), taxonomy.createSynonym)
adminRouter.patch(
  '/synonyms/:id',
  admin,
  validate({ params: v.idParams, body: v.synonymUpdate }),
  taxonomy.updateSynonym,
)
adminRouter.delete('/synonyms/:id', admin, id, taxonomy.deleteSynonym)

// Homepage, pages, settings, cache (ADMIN)
adminRouter.get('/home-sections', admin, content.listSections)
adminRouter.post(
  '/home-sections',
  admin,
  validate({ body: v.sectionCreate }),
  content.createSection,
)
adminRouter.patch(
  '/home-sections/reorder',
  admin,
  validate({ body: v.sectionReorder }),
  content.reorderSections,
)
adminRouter.patch(
  '/home-sections/:id',
  admin,
  validate({ params: v.idParams, body: v.sectionUpdate }),
  content.updateSection,
)
adminRouter.delete('/home-sections/:id', admin, id, content.deleteSection)
adminRouter.get('/pages', admin, content.listPages)
adminRouter.post('/pages', admin, validate({ body: v.pageCreate }), content.createPage)
adminRouter.get('/pages/:id', admin, id, content.getPage)
adminRouter.patch(
  '/pages/:id',
  admin,
  validate({ params: v.idParams, body: v.pageUpdate }),
  content.updatePage,
)
adminRouter.delete('/pages/:id', admin, id, content.deletePage)
adminRouter.get('/settings', admin, content.listSettings)
adminRouter.put(
  '/settings/:key',
  admin,
  validate({ params: v.settingParams, body: v.settingBody }),
  content.putSetting,
)
adminRouter.post('/cache/purge', admin, validate({ body: v.cachePurgeBody }), content.purgeCache)

// Plans and payments (ADMIN)
adminRouter.get('/plans', admin, billing.listPlans)
adminRouter.post('/plans', admin, validate({ body: v.planCreate }), billing.createPlan)
adminRouter.patch(
  '/plans/:id',
  admin,
  validate({ params: v.idParams, body: v.planUpdate }),
  billing.updatePlan,
)
adminRouter.get('/payments', admin, validate({ query: v.paymentQuery }), billing.listPayments)
adminRouter.get('/payments/:id', admin, id, billing.getPayment)

// Users: ADMIN lists and suspends; roles and the audit log are SUPER_ADMIN only.
adminRouter.get('/users', admin, validate({ query: v.userQuery }), users.listUsers)
adminRouter.patch(
  '/users/:id/status',
  admin,
  validate({ params: v.idParams, body: v.userStatusBody }),
  users.setUserStatus,
)
adminRouter.patch(
  '/users/:id/role',
  superAdmin,
  validate({ params: v.idParams, body: v.userRoleBody }),
  users.setUserRole,
)
adminRouter.get('/audit', superAdmin, validate({ query: v.auditQuery }), users.listAudit)
