import { db, readDb } from '../../config/db.js'
import { QUEUE, enqueue } from '../../jobs/queues.js'
import { uniqueSlug } from '../../lib/slug.js'
import { audit, changedFields } from '../../services/audit.js'
import { setAreaCenter } from '../../services/geo.js'
import { pageTagsFor, queueContentChange } from '../../services/revalidate.js'
import { resetSynonymCache } from '../../services/search.js'
import { ApiError } from '../../utils/ApiError.js'
import { created, ok } from '../../utils/ApiResponse.js'
import { RESERVED_SLUGS } from '../../validators/admin.validators.js'

// Names feed searchExtra and category pages, so taxonomy changes resync listings too.
async function afterTaxonomyChange(categories = []) {
  await Promise.all([
    queueContentChange({
      cacheTags: [
        'groups',
        'home',
        'search',
        'areas',
        'market',
        ...categories.map((c) => `category:${c.id}`),
      ],
      pageTags: pageTagsFor({ categories, extra: ['groups', 'home', 'areas'] }),
    }),
    enqueue(QUEUE.DIRECTORY, 'sync-listings', {}),
    enqueue(QUEUE.DIRECTORY, 'refresh-counts', {}),
  ])
}

const taken = (model) => async (slug) => Boolean(await db[model].findUnique({ where: { slug } }))

// ---------- Categories ----------

export async function listCategories(req, res) {
  const rows = await readDb.category.findMany({
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { nameEn: 'asc' }],
    include: { _count: { select: { businesses: true, tags: true, children: true } } },
  })
  // Tree: groups with their categories; market categories separately.
  const groups = rows
    .filter((c) => c.kind === 'DIRECTORY' && !c.parentId)
    .map((g) => ({ ...g, children: rows.filter((c) => c.parentId === g.id) }))
  return ok(res, { groups, market: rows.filter((c) => c.kind === 'MARKET') })
}

async function checkCategory({ kind, parentId, slug }, selfId) {
  if (parentId) {
    const parent = await db.category.findUnique({ where: { id: parentId } })
    if (!parent || parent.parentId || parent.kind !== kind || parent.id === selfId) {
      throw ApiError.badRequest('A category can only sit under a group of the same kind')
    }
  }
  if (!parentId && kind === 'DIRECTORY' && slug && RESERVED_SLUGS.includes(slug)) {
    throw ApiError.badRequest(`"${slug}" is reserved for a site page`)
  }
}

export async function createCategory(req, res) {
  const body = req.body
  const slug =
    body.slug ??
    (await uniqueSlug(
      `${body.kind === 'MARKET' ? 'market ' : ''}${body.nameEn}`,
      async (s) => (await taken('category')(s)) || (!body.parentId && RESERVED_SLUGS.includes(s)),
    ))
  await checkCategory({ ...body, slug })
  if (body.slug && (await taken('category')(body.slug)))
    throw ApiError.conflict('That slug is taken')

  const category = await db.$transaction(async (tx) => {
    const row = await tx.category.create({ data: { ...body, slug } })
    await audit(tx, req, {
      action: 'category.create',
      entity: 'category',
      entityId: row.id,
      diff: { nameEn: row.nameEn },
    })
    return row
  })
  await afterTaxonomyChange([category])
  return created(res, category)
}

export async function updateCategory(req, res) {
  const before = await db.category.findUnique({ where: { id: req.params.id } })
  if (!before) throw ApiError.notFound('Category not found')
  const next = { ...before, ...req.body }
  await checkCategory(next, before.id)
  if (
    req.body.parentId &&
    before.parentId === null &&
    (await db.category.count({ where: { parentId: before.id } }))
  ) {
    throw ApiError.badRequest('Move or delete this group’s categories first')
  }
  if (req.body.slug && req.body.slug !== before.slug && (await taken('category')(req.body.slug))) {
    throw ApiError.conflict('That slug is taken')
  }
  const category = await db.$transaction(async (tx) => {
    const row = await tx.category.update({ where: { id: before.id }, data: req.body })
    await audit(tx, req, {
      action: 'category.update',
      entity: 'category',
      entityId: row.id,
      diff: changedFields(before, req.body),
    })
    return row
  })
  // Old slug pages go stale too.
  await afterTaxonomyChange([category, { id: before.id, slug: before.slug }])
  return ok(res, category)
}

export async function deleteCategory(req, res) {
  const category = await db.category.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { children: true, businesses: true, marketItems: true } } },
  })
  if (!category) throw ApiError.notFound('Category not found')
  const { children, businesses, marketItems } = category._count
  if (children || businesses || marketItems) {
    throw ApiError.conflict(
      'Only empty categories can be deleted; move its categories and listings first',
    )
  }
  await db.$transaction(async (tx) => {
    await tx.tag.updateMany({ where: { categoryId: category.id }, data: { categoryId: null } })
    await tx.category.delete({ where: { id: category.id } })
    await audit(tx, req, {
      action: 'category.delete',
      entity: 'category',
      entityId: category.id,
      diff: { nameEn: category.nameEn },
    })
  })
  await afterTaxonomyChange([category])
  return ok(res, { deleted: true })
}

/** Drag-and-drop result: new parent and order for each moved category. */
export async function reorderCategories(req, res) {
  const ids = req.body.items.map((i) => i.id)
  const existing = await db.category.findMany({ where: { id: { in: ids } } })
  if (existing.length !== ids.length) throw ApiError.badRequest('Unknown category in the list')
  const byId = new Map(existing.map((c) => [c.id, c]))
  for (const item of req.body.items) {
    if (item.parentId !== undefined)
      await checkCategory({ ...byId.get(item.id), parentId: item.parentId }, item.id)
  }
  await db.$transaction(async (tx) => {
    for (const { id, parentId, sortOrder } of req.body.items) {
      await tx.category.update({
        where: { id },
        data: { sortOrder, ...(parentId !== undefined && { parentId }) },
      })
    }
    await audit(tx, req, {
      action: 'category.reorder',
      entity: 'category',
      diff: { items: req.body.items },
    })
  })
  await afterTaxonomyChange(existing)
  return ok(res, { reordered: ids.length })
}

// ---------- Tags ----------

export async function listTags(req, res) {
  return ok(
    res,
    await readDb.tag.findMany({
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
      include: {
        category: { select: { id: true, nameEn: true } },
        _count: { select: { businesses: true } },
      },
    }),
  )
}

export async function createTag(req, res) {
  const slug = req.body.slug ?? (await uniqueSlug(req.body.nameEn, taken('tag'), 'tag'))
  if (req.body.slug && (await taken('tag')(req.body.slug)))
    throw ApiError.conflict('That slug is taken')
  const tag = await db.$transaction(async (tx) => {
    const row = await tx.tag.create({ data: { ...req.body, slug } })
    await audit(tx, req, {
      action: 'tag.create',
      entity: 'tag',
      entityId: row.id,
      diff: { nameEn: row.nameEn },
    })
    return row
  })
  await afterTaxonomyChange(
    tag.categoryId ? [await db.category.findUnique({ where: { id: tag.categoryId } })] : [],
  )
  return created(res, tag)
}

export async function updateTag(req, res) {
  const before = await db.tag.findUnique({ where: { id: req.params.id } })
  if (!before) throw ApiError.notFound('Tag not found')
  if (req.body.slug && req.body.slug !== before.slug && (await taken('tag')(req.body.slug))) {
    throw ApiError.conflict('That slug is taken')
  }
  const tag = await db.$transaction(async (tx) => {
    const row = await tx.tag.update({ where: { id: before.id }, data: req.body })
    await audit(tx, req, {
      action: 'tag.update',
      entity: 'tag',
      entityId: row.id,
      diff: changedFields(before, req.body),
    })
    return row
  })
  const categoryIds = [before.categoryId, tag.categoryId].filter(Boolean)
  await afterTaxonomyChange(await db.category.findMany({ where: { id: { in: categoryIds } } }))
  return ok(res, tag)
}

export async function deleteTag(req, res) {
  const tag = await db.tag.findUnique({ where: { id: req.params.id } })
  if (!tag) throw ApiError.notFound('Tag not found')
  await db.$transaction(async (tx) => {
    await tx.tag.delete({ where: { id: tag.id } }) // business_tags rows cascade
    await audit(tx, req, {
      action: 'tag.delete',
      entity: 'tag',
      entityId: tag.id,
      diff: { nameEn: tag.nameEn },
    })
  })
  await afterTaxonomyChange(
    tag.categoryId ? await db.category.findMany({ where: { id: tag.categoryId } }) : [],
  )
  return ok(res, { deleted: true })
}

// ---------- Areas ----------

export async function listAreas(req, res) {
  return ok(
    res,
    await readDb.$queryRaw`
      SELECT a.id, a.slug, a."nameEn", a."nameNe", a.district, a."sortOrder", a."isVisible",
             ST_Y(a.center::geometry) AS lat, ST_X(a.center::geometry) AS lng,
             (SELECT count(*)::int FROM businesses b WHERE b."areaId" = a.id AND b."deletedAt" IS NULL) AS "listingCount"
      FROM areas a ORDER BY a."sortOrder", a."nameEn"`,
  )
}

export async function createArea(req, res) {
  const { center, ...data } = req.body
  const slug = data.slug ?? (await uniqueSlug(data.nameEn, taken('area'), 'area'))
  if (data.slug && (await taken('area')(data.slug))) throw ApiError.conflict('That slug is taken')
  const area = await db.$transaction(async (tx) => {
    const row = await tx.area.create({ data: { ...data, slug } })
    if (center) await setAreaCenter(tx, row.id, center)
    await audit(tx, req, {
      action: 'area.create',
      entity: 'area',
      entityId: row.id,
      diff: { nameEn: row.nameEn },
    })
    return row
  })
  await afterTaxonomyChange()
  return created(res, area)
}

export async function updateArea(req, res) {
  const before = await db.area.findUnique({ where: { id: req.params.id } })
  if (!before) throw ApiError.notFound('Area not found')
  const { center, ...data } = req.body
  if (data.slug && data.slug !== before.slug && (await taken('area')(data.slug)))
    throw ApiError.conflict('That slug is taken')
  const area = await db.$transaction(async (tx) => {
    const row = await tx.area.update({ where: { id: before.id }, data })
    if (center) await setAreaCenter(tx, row.id, center)
    if (center === null)
      await tx.$executeRaw`UPDATE areas SET center = NULL WHERE id = ${row.id}::uuid`
    await audit(tx, req, {
      action: 'area.update',
      entity: 'area',
      entityId: row.id,
      diff: changedFields(before, req.body),
    })
    return row
  })
  await afterTaxonomyChange()
  return ok(res, area)
}

export async function deleteArea(req, res) {
  const area = await db.area.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { businesses: true, events: true, marketItems: true } } },
  })
  if (!area) throw ApiError.notFound('Area not found')
  if (area._count.businesses || area._count.events || area._count.marketItems) {
    throw ApiError.conflict('This area is in use; hide it instead, or move its listings first')
  }
  await db.$transaction(async (tx) => {
    await tx.area.delete({ where: { id: area.id } })
    await audit(tx, req, {
      action: 'area.delete',
      entity: 'area',
      entityId: area.id,
      diff: { nameEn: area.nameEn },
    })
  })
  await afterTaxonomyChange()
  return ok(res, { deleted: true })
}

// ---------- Synonyms ----------

async function afterSynonymChange() {
  resetSynonymCache()
  await queueContentChange({ cacheTags: ['search'] })
}

export async function listSynonyms(req, res) {
  return ok(res, await readDb.searchSynonym.findMany({ orderBy: { term: 'asc' } }))
}

export async function createSynonym(req, res) {
  if (await db.searchSynonym.findUnique({ where: { term: req.body.term } }))
    throw ApiError.conflict('That term exists')
  const synonym = await db.$transaction(async (tx) => {
    const row = await tx.searchSynonym.create({ data: req.body })
    await audit(tx, req, {
      action: 'synonym.create',
      entity: 'search_synonym',
      entityId: row.id,
      diff: req.body,
    })
    return row
  })
  await afterSynonymChange()
  return created(res, synonym)
}

export async function updateSynonym(req, res) {
  const before = await db.searchSynonym.findUnique({ where: { id: req.params.id } })
  if (!before) throw ApiError.notFound('Synonym not found')
  const synonym = await db.$transaction(async (tx) => {
    const row = await tx.searchSynonym.update({ where: { id: before.id }, data: req.body })
    await audit(tx, req, {
      action: 'synonym.update',
      entity: 'search_synonym',
      entityId: row.id,
      diff: changedFields(before, req.body),
    })
    return row
  })
  await afterSynonymChange()
  return ok(res, synonym)
}

export async function deleteSynonym(req, res) {
  const synonym = await db.searchSynonym.findUnique({ where: { id: req.params.id } })
  if (!synonym) throw ApiError.notFound('Synonym not found')
  await db.$transaction(async (tx) => {
    await tx.searchSynonym.delete({ where: { id: synonym.id } })
    await audit(tx, req, {
      action: 'synonym.delete',
      entity: 'search_synonym',
      entityId: synonym.id,
      diff: { term: synonym.term },
    })
  })
  await afterSynonymChange()
  return ok(res, { deleted: true })
}
