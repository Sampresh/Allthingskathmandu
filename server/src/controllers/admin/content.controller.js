import { db, readDb } from '../../config/db.js'
import { QUEUE, enqueue } from '../../jobs/queues.js'
import { sanitizeRichText } from '../../lib/sanitize.js'
import { audit, changedFields } from '../../services/audit.js'
import { queueContentChange, queueRevalidate } from '../../services/revalidate.js'
import { ApiError } from '../../utils/ApiError.js'
import { created, ok } from '../../utils/ApiResponse.js'
import { SETTING_SCHEMAS } from '../../validators/admin.validators.js'

const homeChanged = () => queueContentChange({ cacheTags: ['home'], pageTags: ['home'] })

// ---------- Homepage builder ----------

export async function listSections(req, res) {
  return ok(
    res,
    await readDb.homeSection.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
  )
}

export async function createSection(req, res) {
  const last = await db.homeSection.findFirst({ orderBy: { sortOrder: 'desc' } })
  const section = await db.$transaction(async (tx) => {
    const row = await tx.homeSection.create({
      data: { ...req.body, sortOrder: (last?.sortOrder ?? -1) + 1 },
    })
    await audit(tx, req, {
      action: 'home_section.create',
      entity: 'home_section',
      entityId: row.id,
      diff: { type: row.type },
    })
    return row
  })
  await homeChanged()
  return created(res, section)
}

export async function updateSection(req, res) {
  const before = await db.homeSection.findUnique({ where: { id: req.params.id } })
  if (!before) throw ApiError.notFound('Section not found')
  const section = await db.$transaction(async (tx) => {
    const row = await tx.homeSection.update({ where: { id: before.id }, data: req.body })
    await audit(tx, req, {
      action: 'home_section.update',
      entity: 'home_section',
      entityId: row.id,
      diff: changedFields(before, req.body),
    })
    return row
  })
  await homeChanged()
  return ok(res, section)
}

export async function deleteSection(req, res) {
  const section = await db.homeSection.findUnique({ where: { id: req.params.id } })
  if (!section) throw ApiError.notFound('Section not found')
  await db.$transaction(async (tx) => {
    await tx.homeSection.delete({ where: { id: section.id } })
    await audit(tx, req, {
      action: 'home_section.delete',
      entity: 'home_section',
      entityId: section.id,
      diff: { type: section.type },
    })
  })
  await homeChanged()
  return ok(res, { deleted: true })
}

/** New order: every section id, top to bottom. */
export async function reorderSections(req, res) {
  const { ids } = req.body
  if ((await db.homeSection.count({ where: { id: { in: ids } } })) !== new Set(ids).size) {
    throw ApiError.badRequest('Unknown section in the list')
  }
  await db.$transaction(async (tx) => {
    for (const [sortOrder, id] of ids.entries())
      await tx.homeSection.update({ where: { id }, data: { sortOrder } })
    await audit(tx, req, { action: 'home_section.reorder', entity: 'home_section', diff: { ids } })
  })
  await homeChanged()
  return ok(res, { reordered: ids.length })
}

// ---------- CMS pages ----------

const pageChanged = (slug) =>
  queueContentChange({ cacheTags: [`page:${slug}`], pageTags: [`page:${slug}`] })

export async function listPages(req, res) {
  return ok(
    res,
    await readDb.cmsPage.findMany({
      orderBy: { slug: 'asc' },
      select: { id: true, slug: true, title: true, isPublished: true, updatedAt: true },
    }),
  )
}

export async function getPage(req, res) {
  const page = await readDb.cmsPage.findUnique({ where: { id: req.params.id } })
  if (!page) throw ApiError.notFound('Page not found')
  return ok(res, page)
}

export async function createPage(req, res) {
  if (await db.cmsPage.findUnique({ where: { slug: req.body.slug } }))
    throw ApiError.conflict('That page exists')
  const page = await db.$transaction(async (tx) => {
    const row = await tx.cmsPage.create({
      data: { ...req.body, body: sanitizeRichText(req.body.body), updatedById: req.user.id },
    })
    await audit(tx, req, {
      action: 'page.create',
      entity: 'cms_page',
      entityId: row.id,
      diff: { slug: row.slug },
    })
    return row
  })
  await pageChanged(page.slug)
  return created(res, page)
}

export async function updatePage(req, res) {
  const before = await db.cmsPage.findUnique({ where: { id: req.params.id } })
  if (!before) throw ApiError.notFound('Page not found')
  const data = {
    ...req.body,
    ...(req.body.body !== undefined && { body: sanitizeRichText(req.body.body) }),
  }
  const page = await db.$transaction(async (tx) => {
    const row = await tx.cmsPage.update({
      where: { id: before.id },
      data: { ...data, updatedById: req.user.id },
    })
    await audit(tx, req, {
      action: 'page.update',
      entity: 'cms_page',
      entityId: row.id,
      diff: changedFields(before, data),
    })
    return row
  })
  await pageChanged(page.slug)
  return ok(res, page)
}

export async function deletePage(req, res) {
  const page = await db.cmsPage.findUnique({ where: { id: req.params.id } })
  if (!page) throw ApiError.notFound('Page not found')
  await db.$transaction(async (tx) => {
    await tx.cmsPage.delete({ where: { id: page.id } })
    await audit(tx, req, {
      action: 'page.delete',
      entity: 'cms_page',
      entityId: page.id,
      diff: { slug: page.slug },
    })
  })
  await pageChanged(page.slug)
  return ok(res, { deleted: true })
}

// ---------- Settings ----------

export async function listSettings(req, res) {
  const rows = await readDb.setting.findMany()
  return ok(res, Object.fromEntries(rows.map((r) => [r.key, r.value])))
}

export async function putSetting(req, res) {
  const { key } = req.params
  const value = SETTING_SCHEMAS[key].parse(req.body.value)
  const before = await db.setting.findUnique({ where: { key } })
  await db.$transaction(async (tx) => {
    await tx.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
    await audit(tx, req, {
      action: 'setting.update',
      entity: 'setting',
      entityId: key,
      diff: { from: before?.value ?? null, to: value },
    })
  })
  // Settings show in the footer of every page.
  await queueContentChange({ cacheTags: ['settings'], pageTags: ['settings'] })
  return ok(res, { key, value })
}

// ---------- Cache ----------

export async function purgeCache(req, res) {
  const { tags, all } = req.body
  await enqueue(QUEUE.CACHE, 'purge', all ? { all: true } : { tags })
  await queueRevalidate(all ? ['home', 'groups', 'areas', 'settings', 'search'] : tags)
  await audit(db, req, {
    action: 'cache.purge',
    entity: 'cache',
    diff: all ? { all: true } : { tags },
  })
  return ok(res, { queued: true })
}
